import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import * as THREE from "three";
import {
  applyExportCameraPose,
  buildExportScene,
  updateExportDepthUniforms,
  type ExportModelSource,
} from "@/lib/exportScene";
import { syncPointSizesForResolution } from "@/lib/pointSize";
import { applyAxisSpin, normalizeRotationAxis } from "@/lib/rotationAxis";
import { syncGlitchUniforms } from "@/lib/types";

export const EXPORT_FPS = 30;
export const EXPORT_MIN_SIZE = 256;
export const EXPORT_MAX_SIZE = 3840;
export const DEFAULT_EXPORT_WIDTH = 1080;
export const DEFAULT_EXPORT_HEIGHT = 1080;

export type SyncMode = "current-speed" | "fit-to-audio";

export type ExportTiming = {
  durationSec: number;
  exportRotationSpeed: number;
};

export function computeExportTiming(opts: {
  revolutions: number;
  rotationSpeed: number;
  syncMode: SyncMode;
  audioDurationSec: number | null;
  audioOffsetSec: number;
}): ExportTiming {
  const revolutions = Math.max(0.5, opts.revolutions);
  const speed = Math.max(0.01, opts.rotationSpeed);
  const offset = Math.max(0, opts.audioOffsetSec);

  if (
    opts.syncMode === "fit-to-audio" &&
    opts.audioDurationSec !== null &&
    opts.audioDurationSec > offset
  ) {
    const durationSec = opts.audioDurationSec - offset;
    return {
      durationSec,
      exportRotationSpeed: (revolutions * Math.PI * 2) / durationSec,
    };
  }

  const durationSec = (revolutions * Math.PI * 2) / speed;
  return {
    durationSec,
    exportRotationSpeed: speed,
  };
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds - m * 60;
  if (m <= 0) return `${s.toFixed(1)}s`;
  return `${m}m ${s.toFixed(1)}s`;
}

export function clampExportSize(n: number): number {
  const v = Math.round(n);
  const clamped = Math.min(EXPORT_MAX_SIZE, Math.max(EXPORT_MIN_SIZE, v));
  return clamped % 2 === 0 ? clamped : clamped - 1;
}

export async function decodeAudioFile(file: File): Promise<AudioBuffer> {
  const ctx = new AudioContext();
  try {
    const data = await file.arrayBuffer();
    return await ctx.decodeAudioData(data.slice(0));
  } finally {
    void ctx.close();
  }
}

/** Slice [offset, offset+duration] from buffer; pad with silence if needed. */
export function sliceAudioBuffer(
  buffer: AudioBuffer,
  offsetSec: number,
  durationSec: number,
): AudioBuffer {
  const sampleRate = buffer.sampleRate;
  const channels = buffer.numberOfChannels;
  const offsetSample = Math.max(0, Math.floor(offsetSec * sampleRate));
  const outLength = Math.max(1, Math.floor(durationSec * sampleRate));
  const out = new AudioBuffer({
    length: outLength,
    numberOfChannels: channels,
    sampleRate,
  });

  for (let ch = 0; ch < channels; ch++) {
    const src = buffer.getChannelData(ch);
    const dst = out.getChannelData(ch);
    for (let i = 0; i < outLength; i++) {
      const srcIndex = offsetSample + i;
      dst[i] = srcIndex < src.length ? src[srcIndex] : 0;
    }
  }
  return out;
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** AVC codec strings with level high enough for the given resolution. */
function avcCodecsForSize(width: number, height: number): string[] {
  const longSide = Math.max(width, height);
  const pixels = width * height;

  // Level ladder (hex level_idc): 1e≈3.0, 1f≈3.1, 28≈4.0, 29≈4.1, 32≈5.0, 33≈5.1, 34≈5.2
  if (longSide <= 1280 && pixels <= 1280 * 720) {
    return ["avc1.42001f", "avc1.4d001f", "avc1.64001f"];
  }
  if (longSide <= 1920 && pixels <= 1920 * 1088) {
    return [
      "avc1.4d0028",
      "avc1.640028",
      "avc1.4d0029",
      "avc1.640029",
      "avc1.42001f",
    ];
  }
  // 4K / up to 3840
  return [
    "avc1.640032",
    "avc1.4d0032",
    "avc1.640033",
    "avc1.4d0033",
    "avc1.640034",
    "avc1.4d0034",
    "avc1.640028",
    "avc1.4d0028",
  ];
}

function bitrateForSize(width: number, height: number): number {
  const pixels = width * height;
  // ~6 bits/pixel/frame @ 30fps → bits/s; floor for SD, headroom for 4K
  const estimated = Math.round(pixels * 6 * EXPORT_FPS * 0.15);
  if (pixels >= 3840 * 2000) return Math.min(40_000_000, Math.max(25_000_000, estimated));
  if (pixels >= 1920 * 1000) return Math.min(20_000_000, Math.max(8_000_000, estimated));
  return Math.min(8_000_000, Math.max(2_000_000, estimated));
}

async function pickAvcConfig(
  width: number,
  height: number,
): Promise<VideoEncoderConfig> {
  if (typeof VideoEncoder === "undefined") {
    throw new Error(
      "WebCodecs VideoEncoder is not available — use Chrome, Edge, or Safari",
    );
  }

  const bitrate = bitrateForSize(width, height);
  const codecs = avcCodecsForSize(width, height);
  const accelerations: HardwareAcceleration[] = [
    "prefer-hardware",
    "prefer-software",
    "no-preference",
  ];

  for (const codec of codecs) {
    for (const hardwareAcceleration of accelerations) {
      const config: VideoEncoderConfig = {
        codec,
        width,
        height,
        bitrate,
        framerate: EXPORT_FPS,
        hardwareAcceleration,
        avc: { format: "avc" },
        latencyMode: "quality",
      };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        if (support.supported) {
          return { ...config, ...(support.config ?? {}) };
        }
      } catch {
        // try next
      }
    }
  }

  throw new Error(
    `H.264 encoding is not supported for ${width}×${height} in this browser (try a smaller resolution, or update Chrome)`,
  );
}

async function waitForEncodeQueue(
  encoder: VideoEncoder,
  maxQueue: number,
  signal?: AbortSignal,
): Promise<void> {
  while (encoder.encodeQueueSize > maxQueue) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }
    await new Promise<void>((resolve) => {
      const prev = encoder.ondequeue;
      encoder.ondequeue = () => {
        encoder.ondequeue = prev;
        resolve();
      };
      // Fallback if ondequeue never fires
      window.setTimeout(resolve, 16);
    });
  }
}

async function pickAacConfig(
  numberOfChannels: number,
  sampleRate: number,
): Promise<AudioEncoderConfig> {
  if (typeof AudioEncoder === "undefined") {
    throw new Error("WebCodecs AudioEncoder is not available");
  }
  const config: AudioEncoderConfig = {
    codec: "mp4a.40.2",
    numberOfChannels,
    sampleRate,
    bitrate: 128_000,
  };
  const support = await AudioEncoder.isConfigSupported(config);
  if (!support.supported) {
    throw new Error("AAC encoding is not supported in this browser");
  }
  return support.config ?? config;
}

async function encodeAudioBuffer(
  buffer: AudioBuffer,
  onChunk: (chunk: EncodedAudioChunk, meta?: EncodedAudioChunkMetadata) => void,
): Promise<void> {
  const config = await pickAacConfig(buffer.numberOfChannels, buffer.sampleRate);
  const encoder = new AudioEncoder({
    output: (chunk, meta) => onChunk(chunk, meta),
    error: (e) => console.error(e),
  });
  encoder.configure(config);

  const channels = buffer.numberOfChannels;
  const frameSize = 1024;
  const sampleRate = buffer.sampleRate;
  const channelData = Array.from({ length: channels }, (_, ch) =>
    buffer.getChannelData(ch),
  );
  const totalSamples = buffer.length;

  for (let offset = 0; offset < totalSamples; offset += frameSize) {
    const frames = Math.min(frameSize, totalSamples - offset);
    const planar = new Float32Array(frames * channels);
    for (let ch = 0; ch < channels; ch++) {
      planar.set(channelData[ch].subarray(offset, offset + frames), ch * frames);
    }
    const audioData = new AudioData({
      format: "f32-planar",
      sampleRate,
      numberOfFrames: frames,
      numberOfChannels: channels,
      timestamp: Math.round((offset / sampleRate) * 1_000_000),
      data: planar,
    });
    encoder.encode(audioData);
    audioData.close();
  }

  await encoder.flush();
  encoder.close();
}

export type OfflineExportOptions = {
  source: ExportModelSource;
  width: number;
  height: number;
  revolutions: number;
  durationSec: number;
  audioBuffer?: AudioBuffer | null;
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
};

/**
 * Offline frame-by-frame render at fixed resolution → MP4 (H.264 + optional AAC).
 * Uses a dedicated offscreen WebGLRenderer so the live canvas keeps running
 * independently, matching R3F sRGB + ACESFilmic tone mapping.
 */
export async function exportOfflineMp4(
  options: OfflineExportOptions,
): Promise<Blob> {
  const width = clampExportSize(options.width);
  const height = clampExportSize(options.height);
  const {
    source,
    revolutions,
    durationSec,
    audioBuffer,
    signal,
    onProgress,
  } = options;

  if (durationSec <= 0.05) {
    throw new Error("Export duration is too short");
  }
  if (!source.modelRoot) {
    throw new Error("Model is not ready for export");
  }

  const videoConfig = await pickAvcConfig(width, height);
  const hasAudio = Boolean(audioBuffer);

  const muxer = new Muxer({
    target: new ArrayBufferTarget(),
    video: { codec: "avc", width, height },
    audio: hasAudio
      ? {
          codec: "aac",
          numberOfChannels: audioBuffer!.numberOfChannels,
          sampleRate: audioBuffer!.sampleRate,
        }
      : undefined,
    fastStart: "in-memory",
    firstTimestampBehavior: "offset",
  });

  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error(e),
  });
  videoEncoder.configure(videoConfig);

  const { scene, root, camera } = buildExportScene(source);
  applyExportCameraPose(camera, width, height, source.camera);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  // Match R3F Canvas defaults (sRGB out + ACES — not NoToneMapping)
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 1);
  syncPointSizesForResolution(root, height);

  const direction =
    source.rotationDirection === 0 ? 1 : source.rotationDirection;
  const spinAxis = normalizeRotationAxis(source.rotationAxis);
  const baseQuat = root.quaternion.clone();
  const spinScratch = new THREE.Quaternion();
  const totalFrames = Math.max(1, Math.round(durationSec * EXPORT_FPS));
  const frameDurationUs = Math.round(1_000_000 / EXPORT_FPS);

  try {
    for (let i = 0; i < totalFrames; i++) {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }

      const t = totalFrames <= 1 ? 0 : i / totalFrames;
      applyAxisSpin(
        root.quaternion,
        baseQuat,
        spinAxis,
        direction * Math.PI * 2 * revolutions * t,
        spinScratch,
      );

      if (source.depthUniforms) {
        updateExportDepthUniforms(
          root,
          camera,
          source.depthUniforms,
          source.invertDepthColors,
        );
      }

      if (source.glitchUniforms && source.glitchSettings) {
        syncGlitchUniforms(
          source.glitchUniforms,
          source.glitchSettings,
          i / EXPORT_FPS,
        );
      }

      renderer.render(scene, camera);

      // Capture before any await — drawing buffer must still be intact
      const frame = new VideoFrame(canvas, {
        timestamp: i * frameDurationUs,
        duration: frameDurationUs,
      });

      await waitForEncodeQueue(videoEncoder, 4, signal);
      videoEncoder.encode(frame, { keyFrame: i % EXPORT_FPS === 0 });
      frame.close();

      onProgress?.(Math.min(0.9, (i + 1) / totalFrames));
      if (i % 2 === 0) await yieldToMain();
    }

    await waitForEncodeQueue(videoEncoder, 0, signal);
    await videoEncoder.flush();
    videoEncoder.close();

    if (hasAudio && audioBuffer) {
      onProgress?.(0.92);
      await encodeAudioBuffer(audioBuffer, (chunk, meta) => {
        muxer.addAudioChunk(chunk, meta);
      });
    }

    muxer.finalize();
    const { buffer } = muxer.target as ArrayBufferTarget;
    onProgress?.(1);
    return new Blob([buffer], { type: "video/mp4" });
  } finally {
    try {
      if (videoEncoder.state !== "closed") videoEncoder.close();
    } catch {
      // already closed
    }
    renderer.dispose();
    scene.clear();
  }
}

export function downloadMp4(blob: Blob, revolutions: number): void {
  downloadBlob(blob, `iso-tricks-${revolutions}rev.mp4`);
}

export function downloadPng(blob: Blob, width: number, height: number): void {
  downloadBlob(blob, `iso-tricks-${width}x${height}.png`);
}

/**
 * Single-frame offline PNG at export resolution (same path as video frames).
 */
export async function exportOfflinePng(options: {
  source: ExportModelSource;
  width: number;
  height: number;
}): Promise<Blob> {
  const width = clampExportSize(options.width);
  const height = clampExportSize(options.height);
  const { source } = options;

  if (!source.modelRoot) {
    throw new Error("Model is not ready for export");
  }

  const { scene, root, camera } = buildExportScene(source);
  applyExportCameraPose(camera, width, height, source.camera);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: "high-performance",
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.setPixelRatio(1);
  renderer.setSize(width, height, false);
  renderer.setClearColor(0x000000, 1);
  syncPointSizesForResolution(root, height);

  try {
    if (source.depthUniforms) {
      updateExportDepthUniforms(
        root,
        camera,
        source.depthUniforms,
        source.invertDepthColors,
      );
    }

    if (source.glitchUniforms && source.glitchSettings) {
      syncGlitchUniforms(
        source.glitchUniforms,
        source.glitchSettings,
        source.sceneTime,
      );
    }

    renderer.render(scene, camera);

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => {
          if (result) resolve(result);
          else reject(new Error("Failed to encode PNG"));
        },
        "image/png",
      );
    });
    return blob;
  } finally {
    renderer.dispose();
    scene.clear();
  }
}
