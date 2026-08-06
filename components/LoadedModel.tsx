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

function applyDisplayMode(
  root: THREE.Object3D,
  mode: DisplayMode,
  pointSize: number,
  lineWidth: number,
): () => void {
  const disposables: Array<{ geometry?: THREE.BufferGeometry; material?: THREE.Material | THREE.Material[] }> = [];
  const originals: Array<{
    object: THREE.Object3D;
    visible: boolean;
  }> = [];

  const pointsGroup = new THREE.Group();
  pointsGroup.name = "__iso_points";
  root.add(pointsGroup);

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
            mat.color?.setHex(WIRE_COLOR);
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
            if (!("map" in mat && mat.map)) {
              mat.color?.setHex(SOLID_COLOR);
            }
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
          const points = new THREE.Points(pointsGeo, pointsMat);
          points.matrix.copy(child.matrixWorld);
          // Place in local space relative to root
          child.updateWorldMatrix(true, false);
          points.position.copy(child.position);
          points.quaternion.copy(child.quaternion);
          points.scale.copy(child.scale);
          pointsGroup.add(points);
          disposables.push({ geometry: pointsGeo, material: pointsMat });
        }
      }
    } else if (child instanceof THREE.LineSegments || child instanceof THREE.Line) {
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
          const points = new THREE.Points(pointsGeo, pointsMat);
          points.position.copy(child.position);
          points.quaternion.copy(child.quaternion);
          points.scale.copy(child.scale);
          pointsGroup.add(points);
          disposables.push({ geometry: pointsGeo, material: pointsMat });
        }
      } else if (child.material instanceof THREE.LineBasicMaterial) {
        child.material.color.setHex(WIRE_COLOR);
        child.material.linewidth = lineWidth;
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
        }
      }
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
    );
    return cleanup;
  }, [cloned, settings.displayMode, settings.pointSize, settings.lineWidth]);

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
