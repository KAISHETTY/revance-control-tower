import type { Alert } from "../engine/alerts";
import type { SiteId } from "../sim/types";
import type { Health } from "./colors";

/** Red if any high-severity alert, amber if any medium, else green. */
export function siteHealth(alerts: readonly Alert[], siteId: SiteId): Health {
  let health: Health = "ok";
  for (const a of alerts) {
    if (a.siteId !== siteId) continue;
    if (a.severity === "high") return "bad";
    if (a.severity === "medium") health = "warn";
  }
  return health;
}
