export type DisplayMode = "wireframe" | "points" | "solid";

export type RotationDirection = 1 | -1 | 0;

export type ModelSettings = {
  displayMode: DisplayMode;
  rotationSpeed: number;
  rotationDirection: RotationDirection;
  angleX: number;
  angleY: number;
  zoom: number;
  pointSize: number;
  lineWidth: number;
  autoRotate: boolean;
  orbitEnabled: boolean;
};

export type ObjectSource =
  | { kind: "demo"; id: DemoId; label: string }
  | { kind: "file"; id: string; label: string; url: string; fileName: string };

export type DemoId =
  | "necker-cube"
  | "tetrahedron"
  | "open-frame"
  | "torus-knot";

export const DEFAULT_SETTINGS: ModelSettings = {
  displayMode: "wireframe",
  rotationSpeed: 0.4,
  rotationDirection: 1,
  angleX: 35.264,
  angleY: 45,
  zoom: 1,
  pointSize: 2.5,
  lineWidth: 1,
  autoRotate: true,
  orbitEnabled: false,
};

export const STORAGE_KEY = "iso_tricks:settings";
