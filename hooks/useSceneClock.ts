"use client";

import { useCallback, useRef, useState } from "react";

/** Scrubber window length (seconds). */
export const SCENE_TIME_LOOP = 10;

export type SceneClock = {
  playing: boolean;
  /** UI snapshot — updated on pause / scrub (not every frame while playing). */
  sceneTime: number;
  setPlaying: (playing: boolean) => void;
  /** Absolute scene time (seconds). */
  setSceneTime: (time: number) => void;
  /** Scrub within the current 10s loop while paused. */
  scrubLoopPosition: (loopPos: number) => void;
  /** Latest time for render / export (always current). */
  getSceneTime: () => number;
  /** Advance when playing; returns new time. Mutates ref only (no React render). */
  advance: (delta: number, timeScale: number) => number;
};

export function useSceneClock(): SceneClock {
  const [playing, setPlayingState] = useState(true);
  const [sceneTime, setSceneTimeState] = useState(0);
  const timeRef = useRef(0);
  const playingRef = useRef(true);

  const setPlaying = useCallback((next: boolean) => {
    playingRef.current = next;
    if (!next) {
      // Sync UI snapshot when freezing
      setSceneTimeState(timeRef.current);
    }
    setPlayingState(next);
  }, []);

  const setSceneTime = useCallback((time: number) => {
    const t = Math.max(0, time);
    timeRef.current = t;
    setSceneTimeState(t);
  }, []);

  const scrubLoopPosition = useCallback((loopPos: number) => {
    const loop = SCENE_TIME_LOOP;
    const pos = Math.min(loop, Math.max(0, loopPos));
    const base = Math.floor(timeRef.current / loop) * loop;
    const t = base + pos;
    timeRef.current = t;
    setSceneTimeState(t);
  }, []);

  const getSceneTime = useCallback(() => timeRef.current, []);

  const advance = useCallback((delta: number, timeScale: number) => {
    if (!playingRef.current) return timeRef.current;
    const scale = Math.min(4, Math.max(0.00001, timeScale));
    timeRef.current += Math.max(0, delta) * scale;
    return timeRef.current;
  }, []);

  return {
    playing,
    sceneTime,
    setPlaying,
    setSceneTime,
    scrubLoopPosition,
    getSceneTime,
    advance,
  };
}
