"use client";

import { useLayoutEffect, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import LoadedModel from "./LoadedModel";
import type { ModelSettings } from "@/lib/types";

type IsoViewerProps = {
  object: THREE.Object3D | null;
  settings: ModelSettings;
  loading?: boolean;
  error?: string | null;
};

function IsoCamera({
  angleX,
  angleY,
  zoom,
}: {
  angleX: number;
  angleY: number;
  zoom: number;
}) {
  const { size } = useThree();
  const cameraRef = useRef<THREE.OrthographicCamera>(null);

  useLayoutEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;

    const w = Math.max(size.width, 1);
    const h = Math.max(size.height, 1);
    const aspect = w / h;
    const frustum = 2.5 / Math.max(zoom, 0.05);

    cam.left = -frustum * aspect;
    cam.right = frustum * aspect;
    cam.top = frustum;
    cam.bottom = -frustum;
    cam.near = -100;
    cam.far = 100;

    const distance = 5;
    const phi = THREE.MathUtils.degToRad(90 - angleX);
    const theta = THREE.MathUtils.degToRad(angleY);
    cam.position.setFromSpherical(new THREE.Spherical(distance, phi, theta));
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
  }, [size.width, size.height, zoom, angleX, angleY]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      near={-100}
      far={100}
      position={[5, 5, 5]}
    />
  );
}

export default function IsoViewer({
  object,
  settings,
  loading = false,
  error = null,
}: IsoViewerProps) {
  return (
    <div className="relative h-full w-full bg-[#0a0a0f]">
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          gl.setClearColor("#0a0a0f", 1);
        }}
      >
        <ambientLight intensity={settings.displayMode === "solid" ? 0.85 : 1} />
        {settings.displayMode === "solid" && (
          <directionalLight position={[4, 6, 2]} intensity={0.45} />
        )}
        <IsoCamera
          angleX={settings.angleX}
          angleY={settings.angleY}
          zoom={settings.zoom}
        />
        {object && <LoadedModel object={object} settings={settings} />}
        {settings.orbitEnabled && (
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            minZoom={0.2}
            maxZoom={8}
          />
        )}
      </Canvas>

      {loading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <p className="text-sm text-zinc-500">Loading model…</p>
        </div>
      )}

      {error && (
        <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center px-4">
          <p className="rounded-md bg-red-950/90 px-3 py-2 text-sm text-red-200 ring-1 ring-red-800">
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
