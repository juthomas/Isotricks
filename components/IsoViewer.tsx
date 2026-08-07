"use client";

import { useEffect, useLayoutEffect, useRef, useState, useCallback, type MutableRefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, OrthographicCamera } from "@react-three/drei";
import * as THREE from "three";
import LoadedModel from "./LoadedModel";
import ExportProgressOverlay from "./ExportProgressOverlay";
import type { ModelSettings } from "@/lib/types";
import { usesDepthColor } from "@/lib/types";
import type { ExportModelSource } from "@/lib/exportScene";
import { captureOrthoCameraState } from "@/lib/exportScene";

type IsoViewerProps = {
  object: THREE.Object3D | null;
  settings: ModelSettings;
  loading?: boolean;
  error?: string | null;
  /** When false, orbit stays mounted but ignores input (keeps camera pose). */
  orbitInteractive?: boolean;
  recording?: boolean;
  exportProgress?: number;
  exportStatus?: string | null;
  /** Letterbox live view to export aspect with a red frame. */
  previewFrame?: boolean;
  exportWidth?: number;
  exportHeight?: number;
  advanceSceneTime?: (delta: number, timeScale: number) => number;
  getSceneTime?: () => number;
  onExportReady?: (getSource: (() => ExportModelSource | null) | null) => void;
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

function SafeOrbitControls({
  enabled,
}: {
  enabled: boolean;
}) {
  const controlsRef = useRef<{ domElement: HTMLElement | null } | null>(null);

  useEffect(() => {
    let cleaned = false;
    let detach: (() => void) | null = null;

    const attach = () => {
      const dom = controlsRef.current?.domElement;
      if (cleaned || detach) return true;
      if (!dom) return false;

      let activePointerId: number | null = null;

      const clearActive = () => {
        activePointerId = null;
      };

      const forceEnd = () => {
        if (activePointerId === null) return;
        const pointerId = activePointerId;
        activePointerId = null;
        // three-stdlib OrbitControls listens on ownerDocument; synthetic up clears stuck drag
        dom.ownerDocument.dispatchEvent(
          new PointerEvent("pointerup", {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: "mouse",
            button: 0,
            buttons: 0,
            view: window,
          }),
        );
      };

      const onPointerDown = (event: PointerEvent) => {
        activePointerId = event.pointerId;
      };

      const onPointerUp = (event: PointerEvent) => {
        if (event.pointerId === activePointerId) clearActive();
      };

      const onPointerMove = (event: PointerEvent) => {
        // Released outside the window: buttons is 0 but controls still think we're dragging
        if (event.buttons === 0 && activePointerId !== null) {
          forceEnd();
        }
      };

      const onBlur = () => forceEnd();

      dom.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("pointerup", onPointerUp);
      document.addEventListener("pointercancel", onPointerUp);
      document.addEventListener("pointermove", onPointerMove);
      window.addEventListener("blur", onBlur);

      detach = () => {
        dom.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("pointerup", onPointerUp);
        document.removeEventListener("pointercancel", onPointerUp);
        document.removeEventListener("pointermove", onPointerMove);
        window.removeEventListener("blur", onBlur);
      };
      return true;
    };

    let pollId: number | null = null;
    if (!attach()) {
      pollId = window.setInterval(() => {
        if (attach() && pollId !== null) {
          window.clearInterval(pollId);
          pollId = null;
        }
      }, 50);
    }

    return () => {
      cleaned = true;
      if (pollId !== null) window.clearInterval(pollId);
      detach?.();
    };
  }, []);

  return (
    <OrbitControls
      ref={controlsRef as never}
      enabled={enabled}
      enableDamping
      dampingFactor={0.08}
      enablePan={false}
      minZoom={0.2}
      maxZoom={8}
    />
  );
}

function ExportBridge({
  settings,
  modelRootRef,
  getSceneTime,
  onExportReady,
}: {
  settings: ModelSettings;
  modelRootRef: MutableRefObject<THREE.Object3D | null>;
  getSceneTime?: () => number;
  onExportReady?: (getSource: (() => ExportModelSource | null) | null) => void;
}) {
  const { camera } = useThree();
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    if (!onExportReady) return;
    onExportReady(() => {
      const modelRoot = modelRootRef.current;
      if (!modelRoot) return null;
      if (!(camera instanceof THREE.OrthographicCamera)) return null;
      camera.updateMatrixWorld(true);
      const s = settingsRef.current;
      return {
        modelRoot,
        depthUniforms: usesDepthColor(s)
          ? ((modelRoot.userData
              .depthUniforms as ExportModelSource["depthUniforms"]) ?? null)
          : null,
        glitchUniforms: s.glitch
          ? ((modelRoot.userData
              .glitchUniforms as ExportModelSource["glitchUniforms"]) ?? null)
          : null,
        glitchSettings: s.glitch
          ? {
              glitchMixCellSize: s.glitchMixCellSize,
              glitchDigitalMin: s.glitchDigitalMin,
              glitchDigitalMax: s.glitchDigitalMax,
              glitchDigitalSpeed: s.glitchDigitalSpeed,
              glitchDeformMin: s.glitchDeformMin,
              glitchDeformMax: s.glitchDeformMax,
              glitchDeformSpeed: s.glitchDeformSpeed,
              glitchScatterMin: s.glitchScatterMin,
              glitchScatterMax: s.glitchScatterMax,
              glitchScatterSpeed: s.glitchScatterSpeed,
              glitchTwistMin: s.glitchTwistMin,
              glitchTwistMax: s.glitchTwistMax,
              glitchTwistSpeed: s.glitchTwistSpeed,
              glitchTpMin: s.glitchTpMin,
              glitchTpMax: s.glitchTpMax,
              glitchTpSpeed: s.glitchTpSpeed,
              glitchChromaMin: s.glitchChromaMin,
              glitchChromaMax: s.glitchChromaMax,
              glitchChromaSpeed: s.glitchChromaSpeed,
              glitchMixWireMin: s.glitchMixWireMin,
              glitchMixWireMax: s.glitchMixWireMax,
              glitchMixWireSpeed: s.glitchMixWireSpeed,
              glitchMixPointsMin: s.glitchMixPointsMin,
              glitchMixPointsMax: s.glitchMixPointsMax,
              glitchMixPointsSpeed: s.glitchMixPointsSpeed,
              glitchMixSolidMin: s.glitchMixSolidMin,
              glitchMixSolidMax: s.glitchMixSolidMax,
              glitchMixSolidSpeed: s.glitchMixSolidSpeed,
            }
          : null,
        invertDepthColors: s.invertDepthColors,
        camera: captureOrthoCameraState(camera),
        rotationDirection: s.rotationDirection,
        displayMode: s.displayMode,
        sceneTime: getSceneTime?.() ?? 0,
      };
    });
    return () => onExportReady(null);
  }, [onExportReady, modelRootRef, camera, getSceneTime]);

  return null;
}

export default function IsoViewer({
  object,
  settings,
  loading = false,
  error = null,
  orbitInteractive = true,
  recording = false,
  exportProgress = 0,
  exportStatus = null,
  previewFrame = false,
  exportWidth = 1080,
  exportHeight = 1080,
  advanceSceneTime,
  getSceneTime,
  onExportReady,
}: IsoViewerProps) {
  const [showLoading, setShowLoading] = useState(false);
  const [displayObject, setDisplayObject] = useState<THREE.Object3D | null>(
    null,
  );
  const [fadeOpacity, setFadeOpacity] = useState(0);
  const displayedRef = useRef<THREE.Object3D | null>(null);
  const modelRootRef = useRef<THREE.Object3D | null>(null);

  const onModelRoot = useCallback((root: THREE.Object3D | null) => {
    modelRootRef.current = root;
  }, []);

  const showExportPreview = previewFrame && !recording;
  const safeW = Math.max(1, exportWidth);
  const safeH = Math.max(1, exportHeight);

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
        className="flex h-full w-full items-center justify-center [container-type:size]"
        style={{
          opacity: fadeOpacity,
          transition: `opacity ${FADE_MS}ms ease`,
        }}
      >
        <div
          className={
            showExportPreview
              ? "relative outline outline-2 outline-[#ef4444] outline-offset-0"
              : "h-full w-full"
          }
          style={
            showExportPreview
              ? {
                  aspectRatio: `${safeW} / ${safeH}`,
                  // Keep ≥12px margin so the red frame stays visible on all sides
                  width: `min(calc(100cqw - 24px), calc((100cqh - 24px) * ${safeW} / ${safeH}))`,
                  height: `min(calc(100cqh - 24px), calc((100cqw - 24px) * ${safeH} / ${safeW}))`,
                }
              : undefined
          }
        >
          <Canvas
            className="h-full w-full"
            frameloop={recording ? "never" : "always"}
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false }}
            onCreated={({ gl }) => {
              gl.setClearColor("#000000", 1);
            }}
          >
            <ExportBridge
              settings={settings}
              modelRootRef={modelRootRef}
              getSceneTime={getSceneTime}
              onExportReady={onExportReady}
            />
            <ambientLight
              intensity={
                settings.displayMode === "solid" &&
                settings.colorMode === "texture"
                  ? 0.55
                  : settings.displayMode === "solid"
                    ? 0.85
                    : 1
              }
            />
            {settings.displayMode === "solid" && (
              <>
                <directionalLight
                  position={
                    settings.colorMode === "texture" ? [5, 8, 4] : [4, 6, 2]
                  }
                  intensity={
                    settings.colorMode === "texture" ? 1.1 : 0.45
                  }
                />
                {settings.colorMode === "texture" && (
                  <directionalLight position={[-4, 2, -3]} intensity={0.35} />
                )}
              </>
            )}
            <IsoCamera
              angleX={settings.angleX}
              angleY={settings.angleY}
              zoom={settings.zoom}
            />
            {displayObject && (
              <LoadedModel
                object={displayObject}
                settings={settings}
                recording={recording}
                advanceSceneTime={advanceSceneTime}
                getSceneTime={getSceneTime}
                onExportRoot={onModelRoot}
              />
            )}
            {settings.orbitEnabled && (
              <SafeOrbitControls enabled={orbitInteractive && !recording} />
            )}
          </Canvas>
        </div>
      </div>

      {recording && (
        <ExportProgressOverlay
          progress={exportProgress}
          status={exportStatus}
        />
      )}

      {showLoading && !recording && (
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
