import type { ObjectKind, World } from "../src/sim/types";

/** Test hooks the app exposes on window (see src/store/useWorld.ts and src/scene/Scene.tsx). */
declare global {
  interface Window {
    __cct?: { state: () => { world: World; seed?: number }; advance: (minutes: number) => void; snapshot: () => string };
    __cctScene?: { project: (kind: ObjectKind, id: string) => { x: number; y: number } | null };
    __cctPerf?: { samples: number[]; calls?: number; triangles?: number };
  }
}
