import { create } from "zustand";
import { classifyTemp } from "../engine/coldchain";
import { physicalRef, resolveRef } from "../sim/lookup";
import { MINUTES_PER_SECOND, tick } from "../sim/tick";
import type { ObjectRef, SiteId, World } from "../sim/types";
import { DEFAULT_SEED, generateWorld } from "../sim/world";
import { hasWebGL } from "../lib/webgl";

export type ViewMode = "network" | SiteId;
export type Speed = 0 | 1 | 5 | 20;
export type RenderMode = "3d" | "2d";
export type Tab = "alerts" | "orders" | "lots" | "how";
export type AlertFilter = "all" | "cold" | "expiry" | "ops" | "shipping";
export type Theme = "dark" | "light";

interface UiState {
  world: World;
  speed: Speed;
  view: ViewMode;
  selection: ObjectRef | null;
  hovered: string | null;
  /** Bumped whenever the camera should fly to the current focus. */
  flyNonce: number;
  renderMode: RenderMode;
  /** Why the app is in 2D: chosen by the user, or forced by the device. */
  renderReason: "user" | "no-webgl" | "slow" | null;
  lowGraphics: boolean;
  theme: Theme;
  tab: Tab;
  alertFilter: AlertFilter;
  paletteOpen: boolean;
  orderDrawer: string | null;

  advance: (minutes: number) => void;
  setSpeed: (s: Speed) => void;
  setView: (v: ViewMode) => void;
  select: (ref: ObjectRef | null, opts?: { fly?: boolean }) => void;
  setHovered: (id: string | null) => void;
  resetView: () => void;
  setRenderMode: (m: RenderMode, reason?: UiState["renderReason"]) => void;
  setLowGraphics: (v: boolean) => void;
  setTheme: (t: Theme) => void;
  setTab: (t: Tab) => void;
  setAlertFilter: (f: AlertFilter) => void;
  setPaletteOpen: (v: boolean) => void;
  openOrder: (orderId: string | null) => void;
  regenerate: (seed?: number) => void;
  resolveTemperature: (ref: ObjectRef) => void;
  repairDock: (dockId: string) => void;
}

function readParams() {
  if (typeof window === "undefined") return new URLSearchParams();
  return new URLSearchParams(window.location.search);
}

function initialSeed(): number {
  const s = Number(readParams().get("seed"));
  return Number.isFinite(s) && s > 0 ? Math.floor(s) : DEFAULT_SEED;
}

function initialSpeed(): Speed {
  const s = Number(readParams().get("speed"));
  return s === 0 || s === 5 || s === 20 ? s : 1;
}

function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem("cct-theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    // Storage can be unavailable (private mode); fall back to dark.
  }
  return "dark";
}

function prefersLowGraphics(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem("cct-low") === "1";
  } catch {
    return false;
  }
}

function initialRender(): { renderMode: RenderMode; renderReason: UiState["renderReason"] } {
  if (!hasWebGL()) return { renderMode: "2d", renderReason: "no-webgl" };
  if (readParams().get("view") === "2d") return { renderMode: "2d", renderReason: "user" };
  return { renderMode: "3d", renderReason: null };
}

/** Site an object belongs to, so selecting it can switch the view there. */
function siteOf(world: World, ref: ObjectRef): SiteId | undefined {
  return resolveRef(world, ref)?.site.id;
}

export const useWorld = create<UiState>((set, get) => ({
  world: generateWorld(initialSeed()),
  speed: initialSpeed(),
  view: "network",
  selection: null,
  hovered: null,
  flyNonce: 0,
  ...initialRender(),
  lowGraphics: prefersLowGraphics(),
  theme: initialTheme(),
  tab: "alerts",
  alertFilter: "all",
  paletteOpen: false,
  orderDrawer: null,

  advance: (minutes) => set((s) => ({ world: tick(s.world, minutes) })),
  setSpeed: (speed) => set({ speed }),
  setView: (view) => set((s) => ({ view, selection: view === "network" ? null : s.selection, flyNonce: s.flyNonce + 1 })),
  select: (ref, opts) =>
    set((s) => {
      if (!ref) return { selection: null };
      const site = siteOf(s.world, ref);
      const physical = physicalRef(s.world, ref);
      const view: ViewMode = ref.kind === "site" ? (ref.id as SiteId) : (site ?? s.view);
      return {
        selection: ref,
        view: physical || ref.kind === "site" ? view : s.view,
        flyNonce: opts?.fly === false ? s.flyNonce : s.flyNonce + 1,
      };
    }),
  setHovered: (hovered) => {
    if (get().hovered !== hovered) set({ hovered });
  },
  resetView: () => set((s) => ({ view: "network", selection: null, flyNonce: s.flyNonce + 1 })),
  setRenderMode: (renderMode, reason = "user") => set({ renderMode, renderReason: renderMode === "2d" ? reason : null }),
  setLowGraphics: (lowGraphics) => {
    try {
      localStorage.setItem("cct-low", lowGraphics ? "1" : "0");
    } catch {
      // Non-essential preference.
    }
    set({ lowGraphics });
  },
  setTheme: (theme) => {
    try {
      localStorage.setItem("cct-theme", theme);
    } catch {
      // Non-essential preference.
    }
    set({ theme });
  },
  setTab: (tab) => set({ tab }),
  setAlertFilter: (alertFilter) => set({ alertFilter, tab: "alerts" }),
  setPaletteOpen: (paletteOpen) => set({ paletteOpen }),
  openOrder: (orderDrawer) => set({ orderDrawer }),
  regenerate: (seed) => {
    const next = seed ?? get().world.seed + 1;
    set((s) => ({ world: generateWorld(next), selection: null, view: "network", flyNonce: s.flyNonce + 1, orderDrawer: null }));
  },
  resolveTemperature: (ref) =>
    set((s) => {
      const sites = structuredClone(s.world.sites);
      for (const site of sites) {
        const room = site.coldRooms.find((r) => r.id === ref.id);
        if (room) {
          room.biasC = 0;
          room.currentC = Math.round((room.setpointC + 0.6) * 100) / 100;
          room.status = classifyTemp(room.currentC, room.setpointC);
        }
        const truck = site.trucks.find((t) => t.id === ref.id);
        if (truck && truck.setpointC !== undefined) {
          truck.tempC = Math.round((truck.setpointC + 0.5) * 100) / 100;
          truck.tempStatus = "ok";
          truck.tempHoldMinutes = 0;
        }
      }
      return { world: { ...s.world, sites } };
    }),
  repairDock: (dockId) =>
    set((s) => {
      const sites = structuredClone(s.world.sites);
      for (const site of sites) {
        const dock = site.docks.find((d) => d.id === dockId);
        if (dock && dock.status === "blocked") {
          dock.status = "free";
          dock.note = undefined;
        }
      }
      return { world: { ...s.world, sites } };
    }),
}));

export { MINUTES_PER_SECOND };

/** Test and debugging hook. Read-only access plus deterministic stepping. */
declare global {
  interface Window {
    __cct?: {
      state: () => UiState;
      advance: (minutes: number) => void;
      snapshot: () => string;
    };
  }
}

if (typeof window !== "undefined") {
  window.__cct = {
    state: () => useWorld.getState(),
    advance: (m) => useWorld.getState().advance(m),
    snapshot: () => JSON.stringify(useWorld.getState().world.sites),
  };
}
