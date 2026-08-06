"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  /** When false, orbit stays mounted but ignores input (keeps camera pose). */
  orbitInteractive?: boolean;
};

const FADE_MS = 180;
const LOADING_DELAY_MS = 1000;

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

  // Projection only — keep current camera pose on resize (orbit / fullscreen)
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
    cam.updateProjectionMatrix();
  }, [size.width, size.height, zoom]);

  // Pose from explicit angle settings (sliders), not from resize
  useLayoutEffect(() => {
    const cam = cameraRef.current;
    if (!cam) return;

    const distance = 5;
    const phi = THREE.MathUtils.degToRad(90 - angleX);
    const theta = THREE.MathUtils.degToRad(angleY);
    cam.position.setFromSpherical(new THREE.Spherical(distance, phi, theta));
    cam.lookAt(0, 0, 0);
    cam.updateMatrixWorld();
  }, [angleX, angleY]);

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
  orbitInteractive = true,
}: IsoViewerProps) {
  const [showLoading, setShowLoading] = useState(false);
  const [displayObject, setDisplayObject] = useState<THREE.Object3D | null>(
    null,
  );
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const displayedRef = useRef<THREE.Object3D | null>(null);

  // Hide loading indicator immediately when load ends (render-phase adjust)
  if (!loading && showLoading) {
    setShowLoading(false);
  }

  // Only show "Loading model…" if load takes longer than 1s
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(
      () => setShowLoading(true),
      LOADING_DELAY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [loading]);

  // Quick fade when the loaded object instance changes
  useEffect(() => {
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];

    const schedule = (fn: () => void, ms: number) => {
      timers.push(setTimeout(fn, ms));
    };

    schedule(() => {
      if (cancelled) return;

      if (!object) {
        setFadeOpacity(0);
        return;
      }

      if (displayedRef.current === object) {
        setFadeOpacity(1);
        return;
      }

      const hadPrevious =
        displayedRef.current !== null && displayedRef.current !== object;

      if (hadPrevious) {
        setFadeOpacity(0);
        schedule(() => {
          if (cancelled) return;
          displayedRef.current = object;
          setDisplayObject(object);
          schedule(() => {
            if (!cancelled) setFadeOpacity(1);
          }, 16);
        }, FADE_MS);
      } else {
        displayedRef.current = object;
        setDisplayObject(object);
        setFadeOpacity(0);
        schedule(() => {
          if (!cancelled) setFadeOpacity(1);
        }, 16);
      }
    }, 0);

    return () => {
      cancelled = true;
      timers.forEach(clearTimeout);
    };
  }, [object]);

  return (
    <div className="relative h-full w-full bg-black">
      <div
        className="h-full w-full"
        style={{
          opacity: fadeOpacity,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        <Canvas
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: false }}
          onCreated={({ gl }) => {
            gl.setClearColor("#000000", 1);
          }}
        >
          <ambientLight
            intensity={settings.displayMode === "solid" ? 0.85 : 1}
          />
          {settings.displayMode === "solid" && (
            <directionalLight position={[4, 6, 2]} intensity={0.45} />
          )}
          <IsoCamera
            angleX={settings.angleX}
            angleY={settings.angleY}
            zoom={settings.zoom}
          />
          {displayObject && (
            <LoadedModel object={displayObject} settings={settings} />
          )}
          {settings.orbitEnabled && (
            <OrbitControls
              enabled={orbitInteractive}
              enableDamping
              dampingFactor={0.08}
              enablePan={false}
              minZoom={0.2}
              maxZoom={8}
            />
          )}
        </Canvas>
      </div>

      {showLoading && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
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
