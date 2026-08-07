"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  syncGlitchUniforms,
  type DisplayMode,
  type GlitchRuntimeUniforms,
  type ModelSettings,
} from "@/lib/types";

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

type LoadedModelProps = {
  object: THREE.Object3D;
  settings: ModelSettings;
  /** When true, skip useFrame updates so offline export owns time/rotation. */
  recording?: boolean;
  onExportRoot?: (root: THREE.Object3D | null) => void;
};

type DepthUniforms = {
  uMinDepth: { value: number };
  uMaxDepth: { value: number };
  uInvertDepth: { value: number };
};

type GlitchUniforms = GlitchRuntimeUniforms;

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
varying vec3 vGlitchWorldPos;
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
varying vec3 vGlitchWorldPos;
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

  vGlitchWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
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
    dot(floor(vGlitchWorldPos * max(uMixScale, 0.01)), vec3(1.0, 17.0, 31.0))
    + floor(uGlitchTime * max(uMixFlicker, 0.01))
  );
  float chosen = 0.0;
  if (cell < nw) chosen = 1.0;
  else if (cell < nw + np) chosen = 2.0;
  else if (cell < nw + np + ns) chosen = 3.0;

  if (uMixLayer < 0.5) {
    if (chosen > 0.5 && abs(chosen - uBaseMode) > 0.5) discard;
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
): void {
  const useDepth = depthUniforms !== null;
  const useGlitch = glitchUniforms !== null;
  if (!useDepth && !useGlitch) return;

  const mixLayerUniform = { value: mixLayer };
  const baseModeUniform = { value: baseMode };

  material.onBeforeCompile = (shader) => {
    if (depthUniforms) Object.assign(shader.uniforms, depthUniforms);
    if (glitchUniforms) Object.assign(shader.uniforms, glitchUniforms);
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

    let fragPars = "";
    if (useDepth) fragPars += DEPTH_FRAGMENT_PARS;
    if (useGlitch) fragPars += GLITCH_FRAGMENT_PARS;

    let fragColor = "";
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
    `iso-fx-d${useDepth ? 1 : 0}-g${useGlitch ? 1 : 0}-m${mixLayer}-b${baseMode}-v5`;
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

function applyDisplayMode(
  root: THREE.Object3D,
  mode: DisplayMode,
  pointSize: number,
  pointDensity: number,
  lineWidth: number,
  depthColors: boolean,
  depthUniforms: DepthUniforms | null,
  glitch: boolean,
  glitchUniforms: GlitchUniforms | null,
): () => void {
  const originals: Array<{
    object: THREE.Object3D;
    visible: boolean;
    material?: THREE.Material | THREE.Material[];
  }> = [];
  const patchedMaterials: THREE.Material[] = [];
  const createdPoints: THREE.Points[] = [];
  const createdMeshes: THREE.Mesh[] = [];
  const createdMaterials: THREE.Material[] = [];

  root.updateMatrixWorld(true);

  const activeDepth = depthColors ? depthUniforms : null;
  const activeGlitch = glitch ? glitchUniforms : null;
  const baseModeId = displayModeToMixId(mode);

  const patch = (mat: THREE.Material, mixLayer: number) => {
    if (!activeDepth && !activeGlitch) return;
    patchMaterialEffects(
      mat,
      activeDepth,
      activeGlitch,
      mixLayer,
      baseModeId,
    );
    patchedMaterials.push(mat);
  };

  const addPointsMatching = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.PointsMaterial,
  ) => {
    const points = new THREE.Points(geometry, material);
    const parent = source.parent ?? root;
    points.position.copy(source.position);
    points.quaternion.copy(source.quaternion);
    points.scale.copy(source.scale);
    parent.add(points);
    createdPoints.push(points);
    return points;
  };

  const addMeshMatching = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(geometry, material);
    const parent = source.parent ?? root;
    mesh.position.copy(source.position);
    mesh.quaternion.copy(source.quaternion);
    mesh.scale.copy(source.scale);
    parent.add(mesh);
    createdMeshes.push(mesh);
    return mesh;
  };

  const makePointsFrom = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    mixLayer: number,
  ) => {
    const position = geometry.getAttribute("position");
    if (!position) return;
    const pointsGeo = new THREE.BufferGeometry();
    pointsGeo.setAttribute(
      "position",
      subsamplePositionAttribute(position, pointDensity),
    );
    const pointsMat = new THREE.PointsMaterial({
      color: POINT_COLOR,
      size: Math.min(10, Math.max(1, pointSize)),
      sizeAttenuation: false,
      toneMapped: false,
      ...OVERLAP_BLENDING,
    });
    createdMaterials.push(pointsMat);
    patch(pointsMat, mixLayer);
    addPointsMatching(source, pointsGeo, pointsMat);
  };

  root.traverse((child) => {
    if (
      (child instanceof THREE.Points && createdPoints.includes(child)) ||
      (child instanceof THREE.Mesh && createdMeshes.includes(child))
    ) {
      return;
    }

    if (child instanceof THREE.Mesh) {
      originals.push({
        object: child,
        visible: child.visible,
        material: child.material,
      });

      if (mode === "wireframe") {
        child.visible = true;
        const wireMat = new THREE.MeshBasicMaterial({
          color: WIRE_COLOR,
          wireframe: true,
          toneMapped: false,
          ...OVERLAP_BLENDING,
        });
        createdMaterials.push(wireMat);
        patch(wireMat, MIX_LAYER_BASE);
        child.material = wireMat;
      } else if (mode === "solid") {
        child.visible = true;
        const mats = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of mats) {
          if (
            mat instanceof THREE.MeshBasicMaterial ||
            mat instanceof THREE.MeshStandardMaterial ||
            mat instanceof THREE.MeshPhongMaterial ||
            mat instanceof THREE.MeshLambertMaterial
          ) {
            mat.wireframe = false;
            if (!("map" in mat && mat.map)) {
              mat.color?.setHex(SOLID_COLOR);
            }
            patch(mat, MIX_LAYER_BASE);
          }
        }
      } else if (mode === "points") {
        child.visible = false;
        makePointsFrom(child, child.geometry, MIX_LAYER_BASE);
      }

      // Glitch mix overlays for the other display modes
      if (glitch && activeGlitch) {
        if (mode !== "wireframe") {
          const wireMat = new THREE.MeshBasicMaterial({
            color: WIRE_COLOR,
            wireframe: true,
            toneMapped: false,
            ...OVERLAP_BLENDING,
          });
          createdMaterials.push(wireMat);
          patch(wireMat, MIX_LAYER_WIRE);
          addMeshMatching(child, child.geometry, wireMat);
        }
        if (mode !== "solid") {
          const solidMat = new THREE.MeshBasicMaterial({
            color: SOLID_COLOR,
            toneMapped: false,
            ...OVERLAP_BLENDING,
          });
          createdMaterials.push(solidMat);
          patch(solidMat, MIX_LAYER_SOLID);
          addMeshMatching(child, child.geometry, solidMat);
        }
        if (mode !== "points") {
          makePointsFrom(child, child.geometry, MIX_LAYER_POINTS);
        }
      }
    } else if (
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Line
    ) {
      originals.push({
        object: child,
        visible: child.visible,
        material: child.material,
      });
      child.visible = mode !== "points";
      if (mode === "points") {
        makePointsFrom(child, child.geometry, MIX_LAYER_BASE);
      } else if (mode === "wireframe") {
        const lineMat = new THREE.LineBasicMaterial({
          color: WIRE_COLOR,
          linewidth: lineWidth,
          toneMapped: false,
          ...OVERLAP_BLENDING,
        });
        createdMaterials.push(lineMat);
        patch(lineMat, MIX_LAYER_BASE);
        child.material = lineMat;
      } else if (child.material instanceof THREE.LineBasicMaterial) {
        child.material.color.setHex(WIRE_COLOR);
        child.material.linewidth = lineWidth;
        patch(child.material, MIX_LAYER_BASE);
      }

      if (glitch && activeGlitch && mode !== "points") {
        makePointsFrom(child, child.geometry, MIX_LAYER_POINTS);
      }
    }
  });

  return () => {
    for (const mat of patchedMaterials) {
      clearEffectPatch(mat);
    }
    for (const { object, visible, material } of originals) {
      object.visible = visible;
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
      // Materials disposed via createdMaterials
    }
    for (const mesh of createdMeshes) {
      mesh.parent?.remove(mesh);
      // Geometry is shared with source — do not dispose
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

export default function LoadedModel({
  object,
  settings,
  recording = false,
  onExportRoot,
}: LoadedModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const depthUniformsRef = useRef(createDepthUniforms());
  const glitchUniformsRef = useRef(createGlitchUniforms());
  const sphereRef = useRef(new THREE.Sphere());
  const boxRef = useRef(new THREE.Box3());
  const cornerRef = useRef(new THREE.Vector3());
  const viewMatrixRef = useRef(new THREE.Matrix4());

  const cloned = useMemo(() => object.clone(true), [object]);

  useEffect(() => {
    const root = groupRef.current;
    if (!root) return;
    root.name = "iso-model-root";
    root.userData.depthUniforms = settings.depthColors
      ? depthUniformsRef.current
      : null;
    root.userData.glitchUniforms = settings.glitch
      ? glitchUniformsRef.current
      : null;
    onExportRoot?.(root);
    return () => onExportRoot?.(null);
  }, [cloned, settings.depthColors, settings.glitch, onExportRoot]);

  useEffect(() => {
    const cleanup = applyDisplayMode(
      cloned,
      settings.displayMode,
      settings.pointSize,
      settings.pointDensity,
      settings.lineWidth,
      settings.depthColors,
      settings.depthColors ? depthUniformsRef.current : null,
      settings.glitch,
      settings.glitch ? glitchUniformsRef.current : null,
    );
    return cleanup;
  }, [
    cloned,
    settings.displayMode,
    settings.pointSize,
    settings.pointDensity,
    settings.lineWidth,
    settings.depthColors,
    settings.glitch,
  ]);

  useFrame((state, delta) => {
    if (recording || !groupRef.current) return;

    if (settings.autoRotate && settings.rotationDirection !== 0) {
      groupRef.current.rotation.y +=
        settings.rotationDirection * settings.rotationSpeed * delta;
    }

    if (settings.glitch) {
      syncGlitchUniforms(
        glitchUniformsRef.current,
        settings,
        state.clock.elapsedTime,
      );
    }

    if (settings.depthColors) {
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
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}
