"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  syncGlitchUniforms,
  usesDepthColor,
  type ColorMode,
  type DisplayMode,
  type GlitchRuntimeUniforms,
  type ModelSettings,
} from "@/lib/types";
import {
  applyAxisSpin,
  normalizeRotationAxis,
  rebaseAxisSpin,
} from "@/lib/rotationAxis";
import {
  clampPointSizeSetting,
  resolvePointPixelSize,
  syncPointSizesForResolution,
} from "@/lib/pointSize";

const WIRE_COLOR = 0xa1a1aa;
const SOLID_COLOR = 0x71717a;
const POINT_COLOR = 0xa1a1aa;

/** Depth-independent combine: keep color (no additive white blowout), no front/back. */
const OVERLAP_BLENDING = {
  blending: THREE.CustomBlending,
  blendEquation: THREE.MaxEquation,
  blendSrc: THREE.OneFactor,
  blendDst: THREE.OneFactor,
  transparent: true,
  depthWrite: false,
  depthTest: false,
} as const;

/**
 * When texture cells are opaque, non-texture mix layers also stay in the opaque
 * pass with depth testing so they cannot paint through textures afterward.
 */
const OVERLAP_BLENDING_DEPTH = {
  blending: THREE.NormalBlending,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  opacity: 1,
} as const;

/** Opaque texture cells — write depth so later wire/points are occluded. */
const TEXTURE_OPAQUE = {
  blending: THREE.NormalBlending,
  transparent: false,
  depthWrite: true,
  depthTest: true,
  opacity: 1,
} as const;

const TEXTURE_RENDER_ORDER = 10;
const OVERLAP_RENDER_ORDER = 0;

type OverlapBlending = typeof OVERLAP_BLENDING | typeof OVERLAP_BLENDING_DEPTH;

type LoadedModelProps = {
  object: THREE.Object3D;
  settings: ModelSettings;
  /** When true, skip useFrame updates so offline export owns time/rotation. */
  recording?: boolean;
  advanceSceneTime?: (delta: number, timeScale: number) => number;
  getSceneTime?: () => number;
  onExportRoot?: (root: THREE.Object3D | null) => void;
  /** Increment to snap orientation back to identity (and re-base spin). */
  rotationResetKey?: number;
};

type DepthUniforms = {
  uMinDepth: { value: number };
  uMaxDepth: { value: number };
  uInvertDepth: { value: number };
};

type GlitchUniforms = GlitchRuntimeUniforms;

type TextureLookUniforms = {
  uTexBright: { value: number };
  uTexContrast: { value: number };
};

const MIX_LAYER_BASE = 0;
const MIX_LAYER_WIRE = 1;
const MIX_LAYER_POINTS = 2;
const MIX_LAYER_SOLID = 3;

function displayModeToMixId(mode: DisplayMode): number {
  if (mode === "wireframe") return MIX_LAYER_WIRE;
  if (mode === "points") return MIX_LAYER_POINTS;
  return MIX_LAYER_SOLID;
}

const DEPTH_VERTEX_PARS = /* glsl */ `
varying float vViewDepth;
`;

const DEPTH_VERTEX_MAIN = /* glsl */ `
vViewDepth = -mvPosition.z;
`;

const DEPTH_FRAGMENT_PARS = /* glsl */ `
uniform float uMinDepth;
uniform float uMaxDepth;
uniform float uInvertDepth;
varying float vViewDepth;

vec3 depthGradient(float t) {
  float h = 0.66 * (1.0 - clamp(t, 0.0, 1.0));
  float s = 0.9;
  float l = 0.55;
  float c = (1.0 - abs(2.0 * l - 1.0)) * s;
  float x = c * (1.0 - abs(mod(h * 6.0, 2.0) - 1.0));
  float m = l - c * 0.5;
  vec3 rgb;
  if (h < 1.0/6.0) rgb = vec3(c, x, 0.0);
  else if (h < 2.0/6.0) rgb = vec3(x, c, 0.0);
  else if (h < 3.0/6.0) rgb = vec3(0.0, c, x);
  else if (h < 4.0/6.0) rgb = vec3(0.0, x, c);
  else if (h < 5.0/6.0) rgb = vec3(x, 0.0, c);
  else rgb = vec3(c, 0.0, x);
  return rgb + m;
}
`;

const DEPTH_FRAGMENT_COLOR = /* glsl */ `
float t = (vViewDepth - uMinDepth) / max(uMaxDepth - uMinDepth, 1e-5);
t = clamp(t, 0.0, 1.0);
if (uInvertDepth > 0.5) t = 1.0 - t;
diffuseColor.rgb = depthGradient(t);
`;

const TEXTURE_LOOK_FRAGMENT_PARS = /* glsl */ `
uniform float uTexBright;
uniform float uTexContrast;
`;

const TEXTURE_LOOK_FRAGMENT_COLOR = /* glsl */ `
{
  vec3 c = diffuseColor.rgb;
  c = (c - 0.5) * uTexContrast + 0.5;
  c *= uTexBright;
  diffuseColor.rgb = clamp(c, 0.0, 1.0);
}
`;

const GLITCH_VERTEX_PARS = /* glsl */ `
uniform float uGlitchTime;
uniform float uGlitchDigital;
uniform float uGlitchDeform;
uniform float uGlitchScatter;
uniform float uGlitchTwist;
uniform float uGlitchTp;
uniform float uGlitchChroma;
uniform float uMixWire;
uniform float uMixPoints;
uniform float uMixSolid;
uniform float uMixFlicker;
uniform float uMixScale;
uniform float uMixLayer;
uniform float uBaseMode;
varying vec3 vGlitchLocalPos;
float isoGlitchHash(float n) { return fract(sin(n) * 43758.5453123); }
`;

const GLITCH_FRAGMENT_PARS = /* glsl */ `
uniform float uGlitchTime;
uniform float uGlitchDigital;
uniform float uGlitchDeform;
uniform float uGlitchScatter;
uniform float uGlitchTwist;
uniform float uGlitchTp;
uniform float uGlitchChroma;
uniform float uMixWire;
uniform float uMixPoints;
uniform float uMixSolid;
uniform float uMixFlicker;
uniform float uMixScale;
uniform float uMixLayer;
uniform float uBaseMode;
varying vec3 vGlitchLocalPos;
float isoGlitchHash(float n) { return fract(sin(n) * 43758.5453123); }
`;

const GLITCH_AFTER_BEGIN = /* glsl */ `
{
  float gDeform = clamp(uGlitchDeform, 0.0, 1.0);
  if (gDeform > 0.0001) {
    vec3 gp = transformed;
    float n1 = isoGlitchHash(gp.x * 2.7 + gp.y * 5.1 + uGlitchTime * 0.4);
    float n2 = isoGlitchHash(gp.z * 3.9 + gp.y * 1.8 + uGlitchTime * 0.55);
    float n3 = isoGlitchHash(gp.x * 4.2 + gp.z * 2.3 + uGlitchTime * 0.35);
    float pulse = 0.65 + 0.35 * sin(uGlitchTime * 3.2 + gp.y * 4.0);
    float spike = step(0.91, isoGlitchHash(floor(uGlitchTime * 4.0) + floor(gp.y * 6.0)));
    transformed += vec3(
      sin(gp.y * 7.0 + uGlitchTime * 5.0) * n1,
      cos(gp.x * 6.0 + uGlitchTime * 4.0) * n2,
      sin(gp.x * 5.0 + gp.z * 4.0 + uGlitchTime * 6.0) * n3
    ) * gDeform * (0.28 * pulse + spike * 0.55);
  }

  float gScatter = clamp(uGlitchScatter, 0.0, 1.0);
  if (gScatter > 0.0001) {
    float id = isoGlitchHash(dot(transformed, vec3(12.9898, 78.233, 37.719)));
    float tick = floor(uGlitchTime * 3.5);
    float burst = step(0.62, isoGlitchHash(id * 40.0 + tick));
    float burst2 = step(0.88, isoGlitchHash(tick * 9.1 + floor(transformed.y * 3.0)));
    vec3 dir = vec3(
      isoGlitchHash(id + 1.1) - 0.5,
      isoGlitchHash(id + 2.3) - 0.5,
      isoGlitchHash(id + 3.7) - 0.5
    );
    transformed += dir * gScatter * (burst * 0.7 + burst2 * 1.2);
    transformed += dir * sin(uGlitchTime * 12.0 + id * 20.0) * gScatter * 0.08;
  }

  float gTwist = clamp(uGlitchTwist, 0.0, 1.0);
  float gTp = clamp(uGlitchTp, 0.0, 1.0);
  if (gTwist > 0.0001 || gTp > 0.0001) {
    float ang = 0.0;
    if (gTwist > 0.0001) {
      ang += transformed.y * (1.8 + sin(uGlitchTime * 1.7) * 1.2) * gTwist;
    }
    if (gTp > 0.0001) {
      float tick = floor(uGlitchTime * 5.0);
      float snap = step(0.8, isoGlitchHash(tick + 3.0));
      ang += snap * (isoGlitchHash(tick) - 0.5) * 6.28318 * gTp;
    }
    float shear = gTwist > 0.0001
      ? sin(uGlitchTime * 2.4 + transformed.y * 3.0) * gTwist * 0.35
      : 0.0;
    float s = sin(ang);
    float c = cos(ang);
    float x = transformed.x * c - transformed.z * s + shear * transformed.y;
    float z = transformed.x * s + transformed.z * c;
    transformed.x = x;
    transformed.z = z;
    if (gTwist > 0.0001) {
      transformed.y += sin(transformed.x * 4.0 + uGlitchTime * 3.0) * gTwist * 0.12;
    }
  }

  vGlitchLocalPos = transformed;
}
`;

const GLITCH_AFTER_PROJECT = /* glsl */ `
{
  float gDigital = clamp(uGlitchDigital, 0.0, 1.0);
  if (gDigital > 0.0001) {
    float gSlice = floor(gl_Position.y * 18.0 + uGlitchTime * 3.0);
    float gBurst = step(0.82, isoGlitchHash(gSlice + floor(uGlitchTime * 7.0)));
    gl_Position.x += (isoGlitchHash(gSlice * 12.9898 + uGlitchTime) - 0.5) * gBurst * gDigital * 0.65 * gl_Position.w;
    float gJ = isoGlitchHash(dot(gl_Position.xy, vec2(12.9898, 78.233)) + uGlitchTime * 19.0);
    gl_Position.xy += (vec2(gJ, isoGlitchHash(gJ * 91.7)) - 0.5) * gDigital * 0.04 * gl_Position.w;
    float gTear = step(0.94, isoGlitchHash(floor(uGlitchTime * 5.0) + floor(gl_Position.y * 4.0)));
    gl_Position.x += (isoGlitchHash(uGlitchTime * 2.1 + gSlice) - 0.5) * gTear * gDigital * 1.1 * gl_Position.w;
  }
}
`;

const GLITCH_MIX_DISCARD = /* glsl */ `
{
  float w = clamp(uMixWire, 0.0, 1.0);
  float p = clamp(uMixPoints, 0.0, 1.0);
  float s = clamp(uMixSolid, 0.0, 1.0);
  float sum = w + p + s;
  float nw = w;
  float np = p;
  float ns = s;
  if (sum > 1.0) {
    nw = w / sum;
    np = p / sum;
    ns = s / sum;
  }
  float cell = isoGlitchHash(
    dot(floor(vGlitchLocalPos * max(uMixScale, 0.01)), vec3(1.0, 17.0, 31.0))
    + floor(uGlitchTime * max(uMixFlicker, 0.01))
  );
  float chosen = 0.0;
  if (cell < nw) chosen = 1.0;
  else if (cell < nw + np) chosen = 2.0;
  else if (cell < nw + np + ns) chosen = 3.0;

  if (uMixLayer < 0.5) {
    // Base yields any cell claimed by a mix overlay (incl. same display mode)
    if (chosen > 0.5) discard;
  } else if (abs(chosen - uMixLayer) > 0.5) {
    discard;
  }
}
`;

const GLITCH_FRAGMENT_COLOR = /* glsl */ `
${GLITCH_MIX_DISCARD}
{
  float gDigital = clamp(uGlitchDigital, 0.0, 1.0);
  if (gDigital > 0.0001) {
    float gTick = floor(uGlitchTime * 11.0);
    float gFlash = step(0.9, isoGlitchHash(gTick * 45.123));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.gbr, gFlash * gDigital);
    float gBand = step(0.86, isoGlitchHash(floor(gl_FragCoord.y * 0.08) + gTick));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.brg, gBand * gDigital * 0.85);
    diffuseColor.r += (isoGlitchHash(uGlitchTime * 3.17) - 0.5) * gDigital * 0.45;
    diffuseColor.b += (isoGlitchHash(uGlitchTime * 5.91) - 0.5) * gDigital * 0.45;
    float gKill = step(0.985, isoGlitchHash(gTick + 17.0));
    diffuseColor.rgb *= 1.0 - gKill * gDigital * 0.85;
  }

  float gDeform = clamp(uGlitchDeform, 0.0, 1.0);
  if (gDeform > 0.0001) {
    float wobble = sin(uGlitchTime * 8.0 + gl_FragCoord.y * 0.05) * 0.5 + 0.5;
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.bgr, wobble * gDeform * 0.35);
  }

  float gScatter = clamp(uGlitchScatter, 0.0, 1.0);
  if (gScatter > 0.0001) {
    float flicker = step(0.92, isoGlitchHash(floor(uGlitchTime * 14.0)));
    diffuseColor.rgb *= 1.0 - flicker * gScatter * 0.5;
    diffuseColor.r += flicker * gScatter * 0.3;
  }

  float gTwist = clamp(uGlitchTwist, 0.0, 1.0);
  if (gTwist > 0.0001) {
    float swirl = (sin(uGlitchTime * 6.0) * 0.5 + 0.5) * gTwist * 0.4;
    diffuseColor.rgb = mix(
      diffuseColor.rgb,
      vec3(diffuseColor.b, diffuseColor.r, diffuseColor.g),
      swirl
    );
  }

  float gTp = clamp(uGlitchTp, 0.0, 1.0);
  if (gTp > 0.0001) {
    float tick = floor(uGlitchTime * 5.0);
    float flash = step(0.85, isoGlitchHash(tick + 11.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.brg, flash * gTp * 0.7);
  }

  float gChroma = clamp(uGlitchChroma, 0.0, 1.0);
  if (gChroma > 0.0001) {
    float gTick = floor(uGlitchTime * 13.0);
    float gFlash = step(0.88, isoGlitchHash(gTick * 17.3));
    float yBand = floor(gl_FragCoord.y * 0.12 + uGlitchTime * 2.0);
    float shift = (isoGlitchHash(yBand) - 0.5) * gChroma;
    diffuseColor.r += shift * 0.9 + gFlash * gChroma * 0.4;
    diffuseColor.g += -shift * 0.5;
    diffuseColor.b += (isoGlitchHash(yBand + 4.0) - 0.5) * gChroma * 0.9 - gFlash * gChroma * 0.2;
    float invert = step(0.96, isoGlitchHash(gTick + 8.0));
    diffuseColor.rgb = mix(diffuseColor.rgb, 1.0 - diffuseColor.rgb, invert * gChroma);
  }
}
`;

function createDepthUniforms(): DepthUniforms {
  return {
    uMinDepth: { value: 0 },
    uMaxDepth: { value: 1 },
    uInvertDepth: { value: 0 },
  };
}

function createGlitchUniforms(): GlitchUniforms {
  return {
    uGlitchTime: { value: 0 },
    uGlitchDigital: { value: 0.55 },
    uGlitchDeform: { value: 0 },
    uGlitchScatter: { value: 0 },
    uGlitchTwist: { value: 0 },
    uGlitchTp: { value: 0 },
    uGlitchChroma: { value: 0 },
    uMixWire: { value: 0 },
    uMixPoints: { value: 0 },
    uMixSolid: { value: 0 },
    uMixFlicker: { value: 2 },
    uMixScale: { value: 7 },
  };
}

function patchMaterialEffects(
  material: THREE.Material,
  depthUniforms: DepthUniforms | null,
  glitchUniforms: GlitchUniforms | null,
  mixLayer: number,
  baseMode: number,
  textureLook: TextureLookUniforms | null,
): void {
  const useDepth = depthUniforms !== null;
  const useGlitch = glitchUniforms !== null;
  const useTexLook = textureLook !== null;
  if (!useDepth && !useGlitch && !useTexLook) return;

  const mixLayerUniform = { value: mixLayer };
  const baseModeUniform = { value: baseMode };

  material.onBeforeCompile = (shader) => {
    if (depthUniforms) Object.assign(shader.uniforms, depthUniforms);
    if (glitchUniforms) Object.assign(shader.uniforms, glitchUniforms);
    if (textureLook) Object.assign(shader.uniforms, textureLook);
    if (useGlitch) {
      shader.uniforms.uMixLayer = mixLayerUniform;
      shader.uniforms.uBaseMode = baseModeUniform;
    }

    let vertexCommon = "";
    if (useDepth) vertexCommon += DEPTH_VERTEX_PARS;
    if (useGlitch) vertexCommon += GLITCH_VERTEX_PARS;

    let afterBegin = useGlitch ? GLITCH_AFTER_BEGIN : "";
    let afterProject = "";
    if (useDepth) afterProject += DEPTH_VERTEX_MAIN;
    if (useGlitch) afterProject += GLITCH_AFTER_PROJECT;

    if (vertexCommon || afterBegin || afterProject) {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", `#include <common>\n${vertexCommon}`)
        .replace(
          "#include <begin_vertex>",
          `#include <begin_vertex>\n${afterBegin}`,
        )
        .replace(
          "#include <project_vertex>",
          `#include <project_vertex>\n${afterProject}`,
        );
    }

    let fragPars = "";
    if (useDepth) fragPars += DEPTH_FRAGMENT_PARS;
    if (useGlitch) fragPars += GLITCH_FRAGMENT_PARS;
    if (useTexLook) fragPars += TEXTURE_LOOK_FRAGMENT_PARS;

    let fragColor = "";
    // Texture look before depth so depth still fully replaces color when active
    if (useTexLook) fragColor += TEXTURE_LOOK_FRAGMENT_COLOR;
    if (useDepth) fragColor += DEPTH_FRAGMENT_COLOR;
    if (useGlitch) fragColor += GLITCH_FRAGMENT_COLOR;

    if (shader.fragmentShader.includes("#include <color_fragment>")) {
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", `#include <common>\n${fragPars}`)
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\n${fragColor}`,
        );
    } else {
      shader.fragmentShader = shader.fragmentShader
        .replace("void main() {", `${fragPars}\nvoid main() {`)
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec4 diffuseColor = vec4( diffuse, opacity );\n${fragColor}`,
        );
    }
  };
  material.customProgramCacheKey = () =>
    `iso-fx-d${useDepth ? 1 : 0}-g${useGlitch ? 1 : 0}-t${useTexLook ? 1 : 0}-m${mixLayer}-b${baseMode}-v7`;
  material.needsUpdate = true;
}

function clearEffectPatch(material: THREE.Material): void {
  material.onBeforeCompile = () => undefined;
  material.customProgramCacheKey = () => "iso-fx-off";
  material.needsUpdate = true;
}

/** Evenly spaced subset of positions (stable as density changes). */
function subsamplePositionAttribute(
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  densityPct: number,
): THREE.BufferAttribute {
  const count = position.count;
  const itemSize = position.itemSize;
  const density = Math.min(100, Math.max(0, densityPct)) / 100;
  const keep = Math.floor(count * density);
  if (keep <= 0) {
    return new THREE.BufferAttribute(new Float32Array(0), itemSize);
  }
  if (keep >= count) {
    return position.clone() as THREE.BufferAttribute;
  }

  const arr = new Float32Array(keep * itemSize);
  for (let i = 0; i < keep; i++) {
    const src = Math.min(count - 1, Math.floor((i * count) / keep));
    for (let c = 0; c < itemSize; c++) {
      arr[i * itemSize + c] = position.getComponent(src, c);
    }
  }
  return new THREE.BufferAttribute(arr, itemSize);
}

function resolveColorMode(mode: ColorMode, hasTextures: boolean): ColorMode {
  if (mode === "texture" && !hasTextures) return "gray";
  return mode;
}

function firstMaterial(
  material: THREE.Material | THREE.Material[],
): THREE.Material | null {
  if (Array.isArray(material)) return material[0] ?? null;
  return material;
}

function materialList(
  material: THREE.Material | THREE.Material[],
): THREE.Material[] {
  return Array.isArray(material) ? material : [material];
}

function applyFlatColorMode(
  mat: THREE.Material,
  colorMode: ColorMode,
  grayHex: number,
): void {
  if (
    !(
      mat instanceof THREE.MeshBasicMaterial ||
      mat instanceof THREE.MeshStandardMaterial ||
      mat instanceof THREE.MeshPhongMaterial ||
      mat instanceof THREE.MeshLambertMaterial
    )
  ) {
    return;
  }
  mat.wireframe = false;
  if (colorMode === "texture") return;
  mat.map = null;
  if ("vertexColors" in mat) mat.vertexColors = false;
  mat.color.setHex(grayHex);
}

/** Unlit copy for mix/wire overlays — preserves MTL Kd / maps. */
function ensureMapColorSpace(map: THREE.Texture | null): void {
  if (!map) return;
  if (map.colorSpace !== THREE.SRGBColorSpace) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.needsUpdate = true;
  }
}

function sourceDiffuseColor(source: THREE.Material): THREE.Color {
  if ("color" in source && source.color instanceof THREE.Color) {
    return source.color.clone();
  }
  return new THREE.Color(0xffffff);
}

function createTexturedSolidMaterial(
  source: THREE.Material,
): THREE.MeshBasicMaterial {
  const map =
    "map" in source && source.map instanceof THREE.Texture ? source.map : null;
  ensureMapColorSpace(map);
  const vertexColors = Boolean(
    "vertexColors" in source && source.vertexColors,
  );
  // With a map, keep tint white so the image drives color; otherwise keep MTL Kd
  const color =
    map || vertexColors
      ? new THREE.Color(0xffffff)
      : sourceDiffuseColor(source);
  return new THREE.MeshBasicMaterial({
    color,
    map,
    vertexColors,
    toneMapped: true,
    side: "side" in source ? source.side : THREE.DoubleSide,
    ...TEXTURE_OPAQUE,
  });
}

function createWireMaterial(
  sourceMaterial: THREE.Material | THREE.Material[] | undefined,
  colorMode: ColorMode,
  overlapBlending: OverlapBlending,
): THREE.MeshBasicMaterial {
  if (colorMode === "texture") {
    const src = firstMaterial(sourceMaterial ?? []);
    if (src) {
      const mat = createTexturedSolidMaterial(src);
      mat.wireframe = true;
      return mat;
    }
  }
  return new THREE.MeshBasicMaterial({
    color: WIRE_COLOR,
    wireframe: true,
    toneMapped: false,
    ...overlapBlending,
  });
}

function createSolidOverlayMaterials(
  sourceMaterial: THREE.Material | THREE.Material[],
  colorMode: ColorMode,
  overlapBlending: OverlapBlending,
): THREE.Material | THREE.Material[] {
  if (colorMode === "texture") {
    // Match base solid+texture: keep lit Phong/Standard MTL materials
    return cloneSolidBaseMaterials(sourceMaterial, "texture");
  }
  return new THREE.MeshBasicMaterial({
    color: SOLID_COLOR,
    toneMapped: false,
    ...overlapBlending,
  });
}

/** Base solid: keep lit MTL/GLTF materials (Phong/Standard) like obj_origin_modifier. */
function cloneSolidBaseMaterials(
  sourceMaterial: THREE.Material | THREE.Material[],
  colorMode: ColorMode,
): THREE.Material | THREE.Material[] {
  const clones = materialList(sourceMaterial).map((src) => {
    const clone = src.clone();
    if ("wireframe" in clone) {
      (clone as THREE.MeshBasicMaterial).wireframe = false;
    }
    if ("map" in clone && clone.map instanceof THREE.Texture) {
      ensureMapColorSpace(clone.map);
    }
    if (colorMode === "texture") {
      Object.assign(clone, TEXTURE_OPAQUE);
      return clone;
    }
    applyFlatColorMode(clone, colorMode, SOLID_COLOR);
    return clone;
  });
  return clones.length === 1 ? clones[0]! : clones;
}

function applyDisplayMode(
  root: THREE.Object3D,
  mode: DisplayMode,
  pointSize: number,
  pointDensity: number,
  mixPointSize: number,
  mixPointDensity: number,
  lineWidth: number,
  colorModes: {
    base: ColorMode;
    mixWire: ColorMode;
    mixPoints: ColorMode;
    mixSolid: ColorMode;
  },
  depthUniforms: DepthUniforms | null,
  glitch: boolean,
  glitchUniforms: GlitchUniforms | null,
  textureLook: TextureLookUniforms,
  mixSolidLook: TextureLookUniforms,
  renderHeight: number,
): () => void {
  const originals: Array<{
    object: THREE.Object3D;
    visible: boolean;
    renderOrder: number;
    material?: THREE.Material | THREE.Material[];
  }> = [];
  const patchedMaterials: THREE.Material[] = [];
  const createdPoints: THREE.Points[] = [];
  const createdMeshes: THREE.Mesh[] = [];
  const createdMaterials: THREE.Material[] = [];

  root.updateMatrixWorld(true);

  const activeGlitch = glitch ? glitchUniforms : null;
  const baseModeId = displayModeToMixId(mode);
  const textureInPlay =
    colorModes.base === "texture" ||
    (Boolean(activeGlitch) &&
      (colorModes.mixWire === "texture" ||
        colorModes.mixPoints === "texture" ||
        colorModes.mixSolid === "texture"));
  // When texture is opaque, overlap layers must depth-test or they paint through it
  const overlapBlending: OverlapBlending = textureInPlay
    ? OVERLAP_BLENDING_DEPTH
    : OVERLAP_BLENDING;

  const patch = (
    mat: THREE.Material,
    mixLayer: number,
    colorMode: ColorMode,
  ) => {
    const layerDepth = colorMode === "depth" ? depthUniforms : null;
    let layerTex: TextureLookUniforms | null = null;
    if (mixLayer === MIX_LAYER_SOLID && colorMode !== "depth") {
      layerTex = mixSolidLook;
    } else if (colorMode === "texture") {
      layerTex = textureLook;
    }
    if (!layerDepth && !activeGlitch && !layerTex) return;
    patchMaterialEffects(
      mat,
      layerDepth,
      activeGlitch,
      mixLayer,
      baseModeId,
      layerTex,
    );
    patchedMaterials.push(mat);
  };

  const addPointsMatching = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.PointsMaterial,
    renderOrder = OVERLAP_RENDER_ORDER,
  ) => {
    const points = new THREE.Points(geometry, material);
    const parent = source.parent ?? root;
    points.position.copy(source.position);
    points.quaternion.copy(source.quaternion);
    points.scale.copy(source.scale);
    points.renderOrder = renderOrder;
    parent.add(points);
    createdPoints.push(points);
    return points;
  };

  const addMeshMatching = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material | THREE.Material[],
    renderOrder = OVERLAP_RENDER_ORDER,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    const parent = source.parent ?? root;
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    mesh.renderOrder = renderOrder;
    parent.add(mesh);
    createdMeshes.push(mesh);
    return mesh;
  };

  const makePointsFrom = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mixLayer: number,
    colorMode: ColorMode,
    sourceMaterial?: THREE.Material | THREE.Material[],
  ) => {
    const position = geometry.getAttribute("position");
    if (!position) return;
    const isMixPoints = mixLayer === MIX_LAYER_POINTS;
    const layerPointSize = isMixPoints ? mixPointSize : pointSize;
    const layerPointDensity = isMixPoints ? mixPointDensity : pointDensity;
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute(
      "position",
      subsamplePositionAttribute(position, layerPointDensity),
    );
    const colorAttr = geometry.getAttribute("color");
    if (colorMode === "texture" && colorAttr) {
      pointsGeo.setAttribute(
        "color",
        subsamplePositionAttribute(colorAttr, layerPointDensity),
      );
    }
    const baseSize = clampPointSizeSetting(layerPointSize);
    const src = firstMaterial(sourceMaterial ?? []);
    const map =
      colorMode === "texture" &&
      src &&
      "map" in src &&
      src.map instanceof THREE.Texture
        ? src.map
        : null;
    if (map) ensureMapColorSpace(map);
    const useVertexColors = colorMode === "texture" && Boolean(colorAttr);
    const srcColor =
      colorMode === "texture" &&
      src &&
      "color" in src &&
      src.color instanceof THREE.Color
        ? src.color.getHex()
        : POINT_COLOR;
    const isTexture = colorMode === "texture";
    const pointsMat = new THREE.PointsMaterial({
      color: isTexture
        ? useVertexColors || map
          ? 0xffffff
          : srcColor
        : POINT_COLOR,
      map,
      vertexColors: useVertexColors,
      size: resolvePointPixelSize(baseSize, renderHeight),
      sizeAttenuation: false,
      toneMapped: isTexture,
      ...(isTexture ? TEXTURE_OPAQUE : overlapBlending),
    });
    pointsMat.userData.basePointSize = baseSize;
    createdMaterials.push(pointsMat);
    patch(pointsMat, mixLayer, colorMode);
    addPointsMatching(
      source,
      pointsGeo,
      pointsMat,
      isTexture ? TEXTURE_RENDER_ORDER : OVERLAP_RENDER_ORDER,
    );
  };

  root.traverse((child) => {
    if (
      (child instanceof THREE.Points && createdPoints.includes(child)) ||
      (child instanceof THREE.Mesh && createdMeshes.includes(child))
    ) {
      return;
    }

    if (child instanceof THREE.Mesh) {
      const originalMaterial = child.material;
      originals.push({
        object: child,
        visible: child.visible,
        renderOrder: child.renderOrder,
        material: originalMaterial,
      });

      if (mode === "wireframe") {
        child.visible = true;
        const wireMat = createWireMaterial(
          originalMaterial,
          colorModes.base,
          overlapBlending,
        );
        createdMaterials.push(wireMat);
        patch(wireMat, MIX_LAYER_BASE, colorModes.base);
        child.material = wireMat;
        child.renderOrder =
          colorModes.base === "texture"
            ? TEXTURE_RENDER_ORDER
            : OVERLAP_RENDER_ORDER;
      } else if (mode === "solid") {
        child.visible = true;
        const solidMats = cloneSolidBaseMaterials(
          originalMaterial,
          colorModes.base,
        );
        for (const mat of materialList(solidMats)) {
          createdMaterials.push(mat);
          patch(mat, MIX_LAYER_BASE, colorModes.base);
        }
        child.material = solidMats;
        child.renderOrder =
          colorModes.base === "texture"
            ? TEXTURE_RENDER_ORDER
            : OVERLAP_RENDER_ORDER;
      } else if (mode === "points") {
        child.visible = false;
        makePointsFrom(
          child,
          child.geometry,
          MIX_LAYER_BASE,
          colorModes.base,
          originalMaterial,
        );
      }

      if (glitch && activeGlitch) {
        const wireMat = createWireMaterial(
          originalMaterial,
          colorModes.mixWire,
          overlapBlending,
        );
        createdMaterials.push(wireMat);
        patch(wireMat, MIX_LAYER_WIRE, colorModes.mixWire);
        addMeshMatching(
          child,
          child.geometry,
          wireMat,
          colorModes.mixWire === "texture"
            ? TEXTURE_RENDER_ORDER
            : OVERLAP_RENDER_ORDER,
        );

        const solidMats = createSolidOverlayMaterials(
          originalMaterial,
          colorModes.mixSolid,
          overlapBlending,
        );
        for (const mat of materialList(solidMats)) {
          createdMaterials.push(mat);
          patch(mat, MIX_LAYER_SOLID, colorModes.mixSolid);
        }
        addMeshMatching(
          child,
          child.geometry,
          solidMats,
          colorModes.mixSolid === "texture"
            ? TEXTURE_RENDER_ORDER
            : OVERLAP_RENDER_ORDER,
        );

        makePointsFrom(
          child,
          child.geometry,
          MIX_LAYER_POINTS,
          colorModes.mixPoints,
          originalMaterial,
        );
      }
    } else if (
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Line
    ) {
      const originalMaterial = child.material;
      originals.push({
        object: child,
        visible: child.visible,
        renderOrder: child.renderOrder,
        material: originalMaterial,
      });
      child.visible = mode !== "points";
      if (mode === "points") {
        makePointsFrom(
          child,
          child.geometry,
          MIX_LAYER_BASE,
          colorModes.base,
          originalMaterial,
        );
      } else if (mode === "wireframe") {
        const lineMat = new THREE.LineBasicMaterial({
          color: colorModes.base === "texture" ? 0xffffff : WIRE_COLOR,
          linewidth: lineWidth,
          toneMapped: colorModes.base === "texture",
          ...(colorModes.base === "texture"
            ? TEXTURE_OPAQUE
            : overlapBlending),
        });
        createdMaterials.push(lineMat);
        patch(lineMat, MIX_LAYER_BASE, colorModes.base);
        child.material = lineMat;
        child.renderOrder =
          colorModes.base === "texture"
            ? TEXTURE_RENDER_ORDER
            : OVERLAP_RENDER_ORDER;
      } else if (child.material instanceof THREE.LineBasicMaterial) {
        if (colorModes.base !== "texture") {
          child.material.color.setHex(WIRE_COLOR);
        }
        child.material.linewidth = lineWidth;
        patch(child.material, MIX_LAYER_BASE, colorModes.base);
      }

      if (glitch && activeGlitch) {
        makePointsFrom(
          child,
          child.geometry,
          MIX_LAYER_POINTS,
          colorModes.mixPoints,
          originalMaterial,
        );
      }
    }
  });

  return () => {
    for (const mat of patchedMaterials) {
      clearEffectPatch(mat);
    }
    for (const { object, visible, renderOrder, material } of originals) {
      object.visible = visible;
      object.renderOrder = renderOrder;
      if (material !== undefined) {
        if (object instanceof THREE.Mesh) {
          object.material = material;
        } else if (
          object instanceof THREE.LineSegments ||
          object instanceof THREE.Line
        ) {
          object.material = material as THREE.Material;
        }
      }
      if (object instanceof THREE.Mesh) {
        const mats = Array.isArray(object.material)
          ? object.material
          : [object.material];
        for (const mat of mats) {
          if ("wireframe" in mat) {
            (mat as THREE.MeshBasicMaterial).wireframe = false;
          }
        }
      }
    }
    for (const points of createdPoints) {
      points.parent?.remove(points);
      points.geometry.dispose();
    }
    for (const mesh of createdMeshes) {
      mesh.parent?.remove(mesh);
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((m) => {
          if (!createdMaterials.includes(m)) m.dispose();
        });
      } else if (!createdMaterials.includes(mesh.material)) {
        mesh.material.dispose();
      }
    }
    for (const mat of createdMaterials) {
      mat.dispose();
    }
  };
}

/** Red spin-axis gizmo (sibling of export root — never included in offline export). */
function RotationAxisPreview({
  axisX,
  axisY,
  axisZ,
  targetRef,
}: {
  axisX: number;
  axisY: number;
  axisZ: number;
  targetRef: RefObject<THREE.Object3D | null>;
}) {
  const helperRef = useRef<THREE.Group>(null);
  const boxRef = useRef(new THREE.Box3());
  const sizeRef = useRef(new THREE.Vector3());
  const axisRef = useRef(new THREE.Vector3());

  const line = useMemo(() => {
    const positions = new Float32Array(6);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3),
    );
    const material = new THREE.LineBasicMaterial({
      color: 0xff2222,
      toneMapped: false,
      depthTest: false,
      depthWrite: false,
    });
    const obj = new THREE.Line(geometry, material);
    obj.renderOrder = 10_000;
    obj.frustumCulled = false;
    return obj;
  }, []);

  useEffect(() => {
    return () => {
      line.geometry.dispose();
      (line.material as THREE.Material).dispose();
    };
  }, [line]);

  useFrame(() => {
    const target = targetRef.current;
    const helper = helperRef.current;
    if (!target || !helper) return;

    target.updateWorldMatrix(true, true);
    // Pivot = object origin (quaternion spin center), not bbox center
    helper.position.setFromMatrixPosition(target.matrixWorld);

    const box = boxRef.current.setFromObject(target);
    if (!box.isEmpty()) {
      box.getSize(sizeRef.current);
    } else {
      sizeRef.current.set(1, 1, 1);
    }
    const len =
      Math.max(sizeRef.current.x, sizeRef.current.y, sizeRef.current.z, 0.5) *
      0.85;

    normalizeRotationAxis(
      { rotationAxisX: axisX, rotationAxisY: axisY, rotationAxisZ: axisZ },
      axisRef.current,
    );

    const attr = line.geometry.getAttribute(
      "position",
    ) as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const a = axisRef.current;
    arr[0] = -a.x * len;
    arr[1] = -a.y * len;
    arr[2] = -a.z * len;
    arr[3] = a.x * len;
    arr[4] = a.y * len;
    arr[5] = a.z * len;
    attr.needsUpdate = true;
  });

  return (
    <group ref={helperRef}>
      <primitive object={line} />
    </group>
  );
}

export default function LoadedModel({
  object,
  settings,
  recording = false,
  advanceSceneTime,
  getSceneTime,
  onExportRoot,
  rotationResetKey = 0,
}: LoadedModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera, size, gl } = useThree();
  const depthUniformsRef = useRef(createDepthUniforms());
  const glitchUniformsRef = useRef(createGlitchUniforms());
  const textureLookRef = useRef<TextureLookUniforms>({
    uTexBright: { value: 1 },
    uTexContrast: { value: 1 },
  });
  const mixSolidLookRef = useRef<TextureLookUniforms>({
    uTexBright: { value: 1 },
    uTexContrast: { value: 1 },
  });
  const sphereRef = useRef(new THREE.Sphere());
  const boxRef = useRef(new THREE.Box3());
  const cornerRef = useRef(new THREE.Vector3());
  const viewMatrixRef = useRef(new THREE.Matrix4());
  const baseQuatRef = useRef(new THREE.Quaternion());
  const axisVecRef = useRef(new THREE.Vector3());
  const spinScratchRef = useRef(new THREE.Quaternion());
  const autoRotatePrevRef = useRef(settings.autoRotate);
  const rotationResetPrevRef = useRef(rotationResetKey);
  const spinParamsRef = useRef({
    axisX: settings.rotationAxisX,
    axisY: settings.rotationAxisY,
    axisZ: settings.rotationAxisZ,
    speed: settings.rotationSpeed,
    dir: settings.rotationDirection,
  });

  const cloned = useMemo(() => object.clone(true), [object]);

  // Reset spin baseline when the model instance changes
  useEffect(() => {
    baseQuatRef.current.identity();
    autoRotatePrevRef.current = settings.autoRotate;
    rotationResetPrevRef.current = rotationResetKey;
    spinParamsRef.current = {
      axisX: settings.rotationAxisX,
      axisY: settings.rotationAxisY,
      axisZ: settings.rotationAxisZ,
      speed: settings.rotationSpeed,
      dir: settings.rotationDirection,
    };
  }, [cloned]);

  // Snap orientation to identity when the panel Reset button fires
  useEffect(() => {
    if (rotationResetKey === rotationResetPrevRef.current) return;
    rotationResetPrevRef.current = rotationResetKey;
    const root = groupRef.current;
    if (!root) return;

    root.quaternion.identity();
    root.rotation.set(0, 0, 0);

    const t = getSceneTime?.() ?? 0;
    const dir = settings.rotationDirection;
    if (settings.autoRotate && dir !== 0) {
      const axis = normalizeRotationAxis(
        {
          rotationAxisX: settings.rotationAxisX,
          rotationAxisY: settings.rotationAxisY,
          rotationAxisZ: settings.rotationAxisZ,
        },
        axisVecRef.current,
      );
      rebaseAxisSpin(
        root.quaternion,
        axis,
        dir * settings.rotationSpeed * t,
        baseQuatRef.current,
        spinScratchRef.current,
      );
    } else {
      baseQuatRef.current.identity();
    }
  }, [
    rotationResetKey,
    settings.autoRotate,
    settings.rotationDirection,
    settings.rotationSpeed,
    settings.rotationAxisX,
    settings.rotationAxisY,
    settings.rotationAxisZ,
    getSceneTime,
  ]);

  // When enabling auto-rotate or changing spin params, rebase so pose doesn't jump
  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;

    const prev = spinParamsRef.current;
    const paramsChanged =
      prev.axisX !== settings.rotationAxisX ||
      prev.axisY !== settings.rotationAxisY ||
      prev.axisZ !== settings.rotationAxisZ ||
      prev.speed !== settings.rotationSpeed ||
      prev.dir !== settings.rotationDirection;
    const enabled = settings.autoRotate && !autoRotatePrevRef.current;

    if (settings.autoRotate && (enabled || paramsChanged)) {
      const t = getSceneTime?.() ?? 0;
      const dir = settings.rotationDirection;
      const axis = normalizeRotationAxis(
        {
          rotationAxisX: settings.rotationAxisX,
          rotationAxisY: settings.rotationAxisY,
          rotationAxisZ: settings.rotationAxisZ,
        },
        axisVecRef.current,
      );
      if (dir !== 0) {
        rebaseAxisSpin(
          root.quaternion,
          axis,
          dir * settings.rotationSpeed * t,
          baseQuatRef.current,
          spinScratchRef.current,
        );
      } else {
        baseQuatRef.current.copy(root.quaternion);
      }
    }

    autoRotatePrevRef.current = settings.autoRotate;
    spinParamsRef.current = {
      axisX: settings.rotationAxisX,
      axisY: settings.rotationAxisY,
      axisZ: settings.rotationAxisZ,
      speed: settings.rotationSpeed,
      dir: settings.rotationDirection,
    };
  }, [
    settings.autoRotate,
    settings.rotationDirection,
    settings.rotationSpeed,
    settings.rotationAxisX,
    settings.rotationAxisY,
    settings.rotationAxisZ,
    getSceneTime,
  ]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    const depthActive = usesDepthColor(settings);
    root.name = "iso-model-root";
    root.userData.depthUniforms = depthActive
      ? depthUniformsRef.current
      : null;
    root.userData.glitchUniforms = settings.glitch
      ? glitchUniformsRef.current
      : null;
    onExportRoot?.(root);
    return () => onExportRoot?.(null);
  }, [cloned, settings, onExportRoot]);

  useEffect(() => {
    const hasTextures = Boolean(cloned.userData.hasTextures);
    const colorModes = {
      base: resolveColorMode(settings.colorMode, hasTextures),
      mixWire: resolveColorMode(settings.glitchMixWireColor, hasTextures),
      mixPoints: resolveColorMode(settings.glitchMixPointsColor, hasTextures),
      mixSolid: resolveColorMode(settings.glitchMixSolidColor, hasTextures),
    };
    const depthActive = usesDepthColor({
      ...settings,
      colorMode: colorModes.base,
      glitchMixWireColor: colorModes.mixWire,
      glitchMixPointsColor: colorModes.mixPoints,
      glitchMixSolidColor: colorModes.mixSolid,
    });
    textureLookRef.current.uTexBright.value = settings.textureBrightness;
    textureLookRef.current.uTexContrast.value = settings.textureContrast;
    mixSolidLookRef.current.uTexBright.value =
      settings.glitchMixSolidBrightness;
    mixSolidLookRef.current.uTexContrast.value =
      settings.glitchMixSolidContrast;
    const cleanup = applyDisplayMode(
      cloned,
      settings.displayMode,
      settings.pointSize,
      settings.pointDensity,
      settings.glitchMixPointsSize,
      settings.glitchMixPointsDensity,
      settings.lineWidth,
      colorModes,
      depthActive ? depthUniformsRef.current : null,
      settings.glitch,
      settings.glitch ? glitchUniformsRef.current : null,
      textureLookRef.current,
      mixSolidLookRef.current,
      Math.max(1, size.height * gl.getPixelRatio()),
    );
    return cleanup;
    // Resize is handled by syncPointSizesForResolution in useFrame
    // eslint-disable-next-line react-hooks/exhaustive-deps -- size/dpr only seed initial point size
  }, [
    cloned,
    settings.displayMode,
    settings.pointSize,
    settings.pointDensity,
    settings.glitchMixPointsSize,
    settings.glitchMixPointsDensity,
    settings.lineWidth,
    settings.colorMode,
    settings.glitchMixWireColor,
    settings.glitchMixPointsColor,
    settings.glitchMixSolidColor,
    settings.glitch,
  ]);

  useFrame((_state, delta) => {
    if (recording || !groupRef.current) return;

    textureLookRef.current.uTexBright.value = settings.textureBrightness;
    textureLookRef.current.uTexContrast.value = settings.textureContrast;
    mixSolidLookRef.current.uTexBright.value =
      settings.glitchMixSolidBrightness;
    mixSolidLookRef.current.uTexContrast.value =
      settings.glitchMixSolidContrast;

    syncPointSizesForResolution(
      groupRef.current,
      Math.max(1, size.height * gl.getPixelRatio()),
    );

    const t = advanceSceneTime
      ? advanceSceneTime(delta, settings.timeScale)
      : (getSceneTime?.() ?? 0);

    if (settings.autoRotate && settings.rotationDirection !== 0) {
      const axis = normalizeRotationAxis(
        {
          rotationAxisX: settings.rotationAxisX,
          rotationAxisY: settings.rotationAxisY,
          rotationAxisZ: settings.rotationAxisZ,
        },
        axisVecRef.current,
      );
      applyAxisSpin(
        groupRef.current.quaternion,
        baseQuatRef.current,
        axis,
        settings.rotationDirection * settings.rotationSpeed * t,
        spinScratchRef.current,
      );
    }

    if (settings.glitch) {
      syncGlitchUniforms(glitchUniformsRef.current, settings, t);
    }

    if (usesDepthColor(settings)) {
      const depthUniforms = depthUniformsRef.current;
      depthUniforms.uInvertDepth.value = settings.invertDepthColors ? 1 : 0;

      groupRef.current.updateWorldMatrix(true, true);
      const box = boxRef.current.setFromObject(groupRef.current);
      if (!box.isEmpty()) {
        box.getBoundingSphere(sphereRef.current);
        const sphere = sphereRef.current;
        viewMatrixRef.current.copy(camera.matrixWorldInverse);

        let minD = Infinity;
        let maxD = -Infinity;
        const c = cornerRef.current;
        for (let i = 0; i < 8; i++) {
          c.set(
            i & 1 ? box.max.x : box.min.x,
            i & 2 ? box.max.y : box.min.y,
            i & 4 ? box.max.z : box.min.z,
          );
          c.applyMatrix4(viewMatrixRef.current);
          const d = -c.z;
          minD = Math.min(minD, d);
          maxD = Math.max(maxD, d);
        }
        const centerView = cornerRef.current
          .copy(sphere.center)
          .applyMatrix4(viewMatrixRef.current);
        const centerD = -centerView.z;
        minD = Math.min(minD, centerD - sphere.radius);
        maxD = Math.max(maxD, centerD + sphere.radius);

        depthUniforms.uMinDepth.value = minD;
        depthUniforms.uMaxDepth.value = Math.max(maxD, minD + 1e-4);
      }
    }
  });

  return (
    <>
      <group ref={groupRef}>
        <primitive object={cloned} />
      </group>
      {settings.showRotationAxis && !recording && (
        <RotationAxisPreview
          axisX={settings.rotationAxisX}
          axisY={settings.rotationAxisY}
          axisZ={settings.rotationAxisZ}
          targetRef={groupRef}
        />
      )}
    </>
  );
}
