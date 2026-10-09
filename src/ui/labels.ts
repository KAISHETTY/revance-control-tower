import type { Tone } from "../components/ui/badge";
import type { ExpiryStatus } from "../engine/expiry";
import type { Severity } from "../engine/reconcile";
import type { ColdStatus, DockStatus, Forklift, Truck } from "../sim/types";

export const SEVERITY_TONE: Record<Severity, Tone> = { high: "bad", medium: "warn", low: "info" };
export const SEVERITY_LABEL: Record<Severity, string> = { high: "High", medium: "Medium", low: "Low" };

export const EXPIRY_TONE: Record<ExpiryStatus, Tone> = { expired: "bad", critical: "bad", warning: "warn", ok: "ok" };
export const EXPIRY_LABEL: Record<ExpiryStatus, string> = {
  expired: "Expired",
  critical: "≤ 30 days",
  warning: "≤ 90 days",
  ok: "OK",
};

export const COLD_TONE: Record<ColdStatus, Tone> = { ok: "ok", warning: "warn", excursion: "bad" };
export const COLD_LABEL: Record<ColdStatus, string> = { ok: "In range", warning: "Warning", excursion: "Excursion" };

export const DOCK_TONE: Record<DockStatus, Tone> = { free: "ok", occupied: "info", blocked: "bad" };
export const DOCK_LABEL: Record<DockStatus, string> = { free: "Free", occupied: "Occupied", blocked: "Blocked" };

export const TRUCK_STATUS_LABEL: Record<Truck["status"], string> = {
  en_route: "En route",
  arrived: "Arrived",
  docked: "Docked",
  loading: "Loading",
  unloading: "Unloading",
  departed: "Departed",
  delayed: "Delayed",
};

export const TRUCK_STATUS_TONE: Record<Truck["status"], Tone> = {
  en_route: "muted",
  arrived: "info",
  docked: "info",
  loading: "info",
  unloading: "info",
  departed: "muted",
  delayed: "warn",
};

export const FORKLIFT_LABEL: Record<Forklift["status"], string> = {
  idle: "Idle",
  moving: "Moving",
  loading: "Handling pallet",
  charging: "Charging",
};
