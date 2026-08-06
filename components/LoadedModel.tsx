"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { DisplayMode, ModelSettings } from "@/lib/types";

const WIRE_COLOR = 0xa1a1aa;
const SOLID_COLOR = 0x71717a;
const POINT_COLOR = 0xa1a1aa;

type LoadedModelProps = {
  object: THREE.Object3D;
  settings: ModelSettings;
};

type DepthUniforms = {
  uMinDepth: { value: number };
  uMaxDepth: { value: number };
  uInvertDepth: { value: number };
};

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

function createDepthUniforms(): DepthUniforms {
  return {
    uMinDepth: { value: 0 },
    uMaxDepth: { value: 1 },
    uInvertDepth: { value: 0 },
  };
}

function patchMaterialForDepth(
  material: THREE.Material,
  uniforms: DepthUniforms,
): void {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\n${DEPTH_VERTEX_PARS}`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>\n${DEPTH_VERTEX_MAIN}`,
      );

    if (shader.fragmentShader.includes("#include <color_fragment>")) {
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "#include <common>",
          `#include <common>\n${DEPTH_FRAGMENT_PARS}`,
        )
        .replace(
          "#include <color_fragment>",
          `#include <color_fragment>\n${DEPTH_FRAGMENT_COLOR}`,
        );
    } else {
      // PointsMaterial / LineBasicMaterial have a simpler fragment shader
      shader.fragmentShader = shader.fragmentShader
        .replace(
          "void main() {",
          `${DEPTH_FRAGMENT_PARS}\nvoid main() {`,
        )
        .replace(
          "vec4 diffuseColor = vec4( diffuse, opacity );",
          `vec4 diffuseColor = vec4( diffuse, opacity );\n${DEPTH_FRAGMENT_COLOR}`,
        );
    }
  };
  material.customProgramCacheKey = () => "iso-depth-colors-v1";
  material.needsUpdate = true;
}

function clearDepthPatch(material: THREE.Material): void {
  material.onBeforeCompile = () => undefined;
  // Force a fresh program without depth uniforms
  material.customProgramCacheKey = () => "iso-depth-off";
  material.needsUpdate = true;
}

function applyDisplayMode(
  root: THREE.Object3D,
  mode: DisplayMode,
  pointSize: number,
  lineWidth: number,
  depthColors: boolean,
  depthUniforms: DepthUniforms | null,
): () => void {
  const originals: Array<{
    object: THREE.Object3D;
    visible: boolean;
  }> = [];
  const patchedMaterials: THREE.Material[] = [];
  const createdPoints: THREE.Points[] = [];

  // Ensure world matrices are current before baking points into the same space
  root.updateMatrixWorld(true);

  const patch = (mat: THREE.Material) => {
    if (!depthColors || !depthUniforms) return;
    patchMaterialForDepth(mat, depthUniforms);
    patchedMaterials.push(mat);
  };

  /** Place Points with the same world transform as `source` (handles nested GLB hierarchies). */
  const addPointsMatching = (
    source: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.PointsMaterial,
  ) => {
    const points = new THREE.Points(geometry, material);
    const parent = source.parent ?? root;
    // Match source's local transform under the same parent
    points.position.copy(source.position);
    points.quaternion.copy(source.quaternion);
    points.scale.copy(source.scale);
    parent.add(points);
    createdPoints.push(points);
  };

  root.traverse((child) => {
    if (child instanceof THREE.Points && createdPoints.includes(child)) {
      return;
    }

    if (child instanceof THREE.Mesh) {
      originals.push({ object: child, visible: child.visible });

      if (mode === "wireframe") {
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
            mat.wireframe = true;
            mat.color?.setHex(WIRE_COLOR);
            if ("emissive" in mat && mat.emissive) {
              mat.emissive.setHex(0x000000);
            }
            patch(mat);
          }
        }
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
            patch(mat);
          }
        }
      } else if (mode === "points") {
        child.visible = false;
        const position = child.geometry.getAttribute("position");
        if (position) {
          const pointsGeo = new THREE.BufferGeometry();
          pointsGeo.setAttribute("position", position.clone());
          const pointsMat = new THREE.PointsMaterial({
            color: POINT_COLOR,
            size: pointSize * 0.02,
            sizeAttenuation: true,
          });
          patch(pointsMat);
          addPointsMatching(child, pointsGeo, pointsMat);
        }
      }
    } else if (
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Line
    ) {
      originals.push({ object: child, visible: child.visible });
      child.visible = mode !== "points";
      if (mode === "points") {
        const position = child.geometry.getAttribute("position");
        if (position) {
          const pointsGeo = new THREE.BufferGeometry();
          pointsGeo.setAttribute("position", position.clone());
          const pointsMat = new THREE.PointsMaterial({
            color: POINT_COLOR,
            size: pointSize * 0.02,
            sizeAttenuation: true,
          });
          patch(pointsMat);
          addPointsMatching(child, pointsGeo, pointsMat);
        }
      } else if (child.material instanceof THREE.LineBasicMaterial) {
        child.material.color.setHex(WIRE_COLOR);
        child.material.linewidth = lineWidth;
        patch(child.material);
      }
    }
  });

  return () => {
    for (const mat of patchedMaterials) {
      clearDepthPatch(mat);
    }
    for (const { object, visible } of originals) {
      object.visible = visible;
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
      if (Array.isArray(points.material)) {
        points.material.forEach((m) => m.dispose());
      } else {
        points.material.dispose();
      }
    }
  };
}

export default function LoadedModel({ object, settings }: LoadedModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const depthUniformsRef = useRef(createDepthUniforms());
  const sphereRef = useRef(new THREE.Sphere());
  const boxRef = useRef(new THREE.Box3());
  const cornerRef = useRef(new THREE.Vector3());
  const viewMatrixRef = useRef(new THREE.Matrix4());

  const cloned = useMemo(() => object.clone(true), [object]);

  useEffect(() => {
    const cleanup = applyDisplayMode(
      cloned,
      settings.displayMode,
      settings.pointSize,
      settings.lineWidth,
      settings.depthColors,
      settings.depthColors ? depthUniformsRef.current : null,
    );
    return cleanup;
  }, [
    cloned,
    settings.displayMode,
    settings.pointSize,
    settings.lineWidth,
    settings.depthColors,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;

    if (settings.autoRotate && settings.rotationDirection !== 0) {
      groupRef.current.rotation.y +=
        settings.rotationDirection * settings.rotationSpeed * delta;
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
