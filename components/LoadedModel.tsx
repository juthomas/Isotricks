"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { DisplayMode, ModelSettings } from "@/lib/types";

const WIRE_COLOR = 0xa1a1aa;
const SOLID_COLOR = 0x71717a;
const POINT_COLOR = 0xa1a1aa;

type LoadedModelProps = {
  object: THREE.Object3D;
  settings: ModelSettings;
};

/** Spectral-ish height map: blue (low) → cyan → green → yellow → red (high) */
function heightToColor(t: number, target: THREE.Color) {
  const clamped = Math.min(1, Math.max(0, t));
  target.setHSL(0.66 * (1 - clamped), 0.9, 0.55);
}

function computeLocalBounds(root: THREE.Object3D): THREE.Box3 {
  root.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const v = new THREE.Vector3();

  root.traverse((child) => {
    if (
      !(
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments ||
        child instanceof THREE.Points
      )
    ) {
      return;
    }
    const position = child.geometry?.getAttribute("position");
    if (!position) return;

    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      child.localToWorld(v);
      root.worldToLocal(v);
      box.expandByPoint(v);
    }
  });

  return box;
}

function applyHeightVertexColors(root: THREE.Object3D): void {
  const box = computeLocalBounds(root);
  if (box.isEmpty()) return;

  const minY = box.min.y;
  const range = Math.max(box.max.y - minY, 1e-6);
  const color = new THREE.Color();
  const v = new THREE.Vector3();

  root.updateMatrixWorld(true);

  root.traverse((child) => {
    if (
      !(
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments ||
        child instanceof THREE.Points
      )
    ) {
      return;
    }
    if (child.parent?.name === "__iso_points") return;

    const geometry = child.geometry;
    const position = geometry?.getAttribute("position");
    if (!position) return;

    const colors = new Float32Array(position.count * 3);
    for (let i = 0; i < position.count; i++) {
      v.fromBufferAttribute(position, i);
      child.localToWorld(v);
      root.worldToLocal(v);
      heightToColor((v.y - minY) / range, color);
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
    }
    geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  });
}

function enableVertexColors(material: THREE.Material, enabled: boolean) {
  if (
    material instanceof THREE.MeshBasicMaterial ||
    material instanceof THREE.MeshStandardMaterial ||
    material instanceof THREE.MeshPhongMaterial ||
    material instanceof THREE.MeshLambertMaterial ||
    material instanceof THREE.LineBasicMaterial ||
    material instanceof THREE.PointsMaterial
  ) {
    material.vertexColors = enabled;
    if (enabled) {
      material.color.setHex(0xffffff);
    }
    material.needsUpdate = true;
  }
}

function applyDisplayMode(
  root: THREE.Object3D,
  mode: DisplayMode,
  pointSize: number,
  lineWidth: number,
  heightColors: boolean,
): () => void {
  const disposables: Array<{
    geometry?: THREE.BufferGeometry;
    material?: THREE.Material | THREE.Material[];
  }> = [];
  const originals: Array<{
    object: THREE.Object3D;
    visible: boolean;
  }> = [];
  const coloredGeometries: THREE.BufferGeometry[] = [];

  if (heightColors) {
    applyHeightVertexColors(root);
    root.traverse((child) => {
      if (
        child instanceof THREE.Mesh ||
        child instanceof THREE.Line ||
        child instanceof THREE.LineSegments
      ) {
        if (child.geometry?.getAttribute("color")) {
          coloredGeometries.push(child.geometry);
        }
      }
    });
  }

  const pointsGroup = new THREE.Group();
  pointsGroup.name = "__iso_points";
  root.add(pointsGroup);

  const flatTint = heightColors ? 0xffffff : undefined;

  root.traverse((child) => {
    if (child === pointsGroup) return;

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
            mat.color?.setHex(flatTint ?? WIRE_COLOR);
            enableVertexColors(mat, heightColors);
            if ("emissive" in mat && mat.emissive) {
              mat.emissive.setHex(0x000000);
            }
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
            if (heightColors || !("map" in mat && mat.map)) {
              mat.color?.setHex(flatTint ?? SOLID_COLOR);
            }
            enableVertexColors(mat, heightColors);
          }
        }
      } else if (mode === "points") {
        child.visible = false;
        const position = child.geometry.getAttribute("position");
        if (position) {
          const pointsGeo = new THREE.BufferGeometry();
          pointsGeo.setAttribute("position", position.clone());
          const sourceColors = child.geometry.getAttribute("color");
          if (heightColors && sourceColors) {
            pointsGeo.setAttribute("color", sourceColors.clone());
          }
          const pointsMat = new THREE.PointsMaterial({
            color: heightColors ? 0xffffff : POINT_COLOR,
            size: pointSize * 0.02,
            sizeAttenuation: true,
            vertexColors: heightColors,
          });
          const points = new THREE.Points(pointsGeo, pointsMat);
          child.updateWorldMatrix(true, false);
          points.position.copy(child.position);
          points.quaternion.copy(child.quaternion);
          points.scale.copy(child.scale);
          pointsGroup.add(points);
          disposables.push({ geometry: pointsGeo, material: pointsMat });
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
          const sourceColors = child.geometry.getAttribute("color");
          if (heightColors && sourceColors) {
            pointsGeo.setAttribute("color", sourceColors.clone());
          }
          const pointsMat = new THREE.PointsMaterial({
            color: heightColors ? 0xffffff : POINT_COLOR,
            size: pointSize * 0.02,
            sizeAttenuation: true,
            vertexColors: heightColors,
          });
          const points = new THREE.Points(pointsGeo, pointsMat);
          points.position.copy(child.position);
          points.quaternion.copy(child.quaternion);
          points.scale.copy(child.scale);
          pointsGroup.add(points);
          disposables.push({ geometry: pointsGeo, material: pointsMat });
        }
      } else if (child.material instanceof THREE.LineBasicMaterial) {
        child.material.color.setHex(flatTint ?? WIRE_COLOR);
        child.material.linewidth = lineWidth;
        enableVertexColors(child.material, heightColors);
      }
    }
  });

  return () => {
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
          enableVertexColors(mat, false);
        }
      } else if (
        object instanceof THREE.Line ||
        object instanceof THREE.LineSegments
      ) {
        if (object.material instanceof THREE.LineBasicMaterial) {
          enableVertexColors(object.material, false);
        }
      }
    }
    for (const geometry of coloredGeometries) {
      geometry.deleteAttribute("color");
    }
    root.remove(pointsGroup);
    pointsGroup.traverse((c) => {
      if (c instanceof THREE.Points) {
        c.geometry.dispose();
        if (Array.isArray(c.material)) {
          c.material.forEach((m) => m.dispose());
        } else {
          c.material.dispose();
        }
      }
    });
    for (const d of disposables) {
      d.geometry?.dispose();
      if (Array.isArray(d.material)) {
        d.material.forEach((m) => m.dispose());
      } else {
        d.material?.dispose();
      }
    }
  };
}

export default function LoadedModel({ object, settings }: LoadedModelProps) {
  const groupRef = useRef<THREE.Group>(null);

  const cloned = useMemo(() => object.clone(true), [object]);

  useEffect(() => {
    const cleanup = applyDisplayMode(
      cloned,
      settings.displayMode,
      settings.pointSize,
      settings.lineWidth,
      settings.heightColors,
    );
    return cleanup;
  }, [
    cloned,
    settings.displayMode,
    settings.pointSize,
    settings.lineWidth,
    settings.heightColors,
  ]);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    if (settings.autoRotate && settings.rotationDirection !== 0) {
      groupRef.current.rotation.y +=
        settings.rotationDirection * settings.rotationSpeed * delta;
    }
  });

  return (
    <group ref={groupRef}>
      <primitive object={cloned} />
    </group>
  );
}
