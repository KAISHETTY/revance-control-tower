import type { ExpiryStatus } from "../engine/expiry";
import type { ColdStatus, DockStatus } from "../sim/types";

/** One palette for 3D and 2D so both views read the same. */
export const EXPIRY_COLORS: Record<ExpiryStatus, string> = {
  ok: "#c9a777",
  warning: "#f5b83d",
  critical: "#f2762e",
  expired: "#e5484d",
};

export const DOCK_COLORS: Record<DockStatus, string> = {
  free: "#34d399",
  occupied: "#60a5fa",
  blocked: "#f43f5e",
};

export const COLD_COLORS: Record<ColdStatus, string> = {
  ok: "#38bdf8",
  warning: "#fbbf24",
  excursion: "#f43f5e",
};

export const HEALTH_COLORS = { ok: "#34d399", warn: "#fbbf24", bad: "#f43f5e" } as const;
export type Health = keyof typeof HEALTH_COLORS;

export const CARRIER_COLORS: Record<string, string> = {
  "Ridgeline Freight": "#2563eb",
  "BlueArc Logistics": "#0891b2",
  "Cumberland Express": "#7c3aed",
  "Polar Line Reefer": "#0e7490",
  "Summit Carriers": "#15803d",
  "Harbor & Vale Transport": "#b45309",
};

export const FORKLIFT_COLOR = "#facc15";

export interface ScenePalette {
  background: string;
  ground: string;
  island: string;
  islandEdge: string;
  road: string;
  roadLine: string;
  floor: string;
  wall: string;
  fog: string;
}

export const SCENE_DARK: ScenePalette = {
  background: "#0a0f1c",
  ground: "#0e1626",
  island: "#1b2638",
  islandEdge: "#2a3953",
  road: "#273246",
  roadLine: "#5b6b86",
  floor: "#2b3647",
  wall: "#c3ccd9",
  fog: "#0a0f1c",
};

export const SCENE_LIGHT: ScenePalette = {
  background: "#dfe7f1",
  ground: "#d3dce8",
  island: "#eef2f7",
  islandEdge: "#c3cfde",
  road: "#a9b6c8",
  roadLine: "#f8fafc",
  floor: "#dde3ec",
  wall: "#f8fafc",
  fog: "#dfe7f1",
};
