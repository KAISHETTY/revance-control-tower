import { daysBetween } from "../lib/dates";
import { formatMinutes, formatTemp } from "../lib/format";
import { productName } from "../sim/products";
import type { ObjectRef, SiteId, World } from "../sim/types";
import { classifyExpiry, daysToExpiry } from "./expiry";
import { SEVERITY_RANK, type Severity } from "./reconcile";

export type AlertType =
  | "COLD_EXCURSION"
  | "COLD_WARNING"
  | "LOT_EXPIRED"
  | "LOT_EXPIRING"
  | "TRUCK_DELAYED"
  | "DOCK_BLOCKED"
  | "FORKLIFT_BATTERY"
  | "SHIPMENT_LATE";

export type AlertCategory = "cold" | "expiry" | "ops" | "shipping";

export interface Alert {
  id: string;
  type: AlertType;
  category: AlertCategory;
  severity: Severity;
  siteId: SiteId;
  ref: ObjectRef;
  title: string;
  nextStep: string;
}

const TRUCK_DELAY_ALERT_MINUTES = 60;
const FORKLIFT_CRITICAL_BATTERY = 15;
/** Late shipments older than this are left to the order-to-cash view. */
const LATE_SHIPMENT_WINDOW_DAYS = 14;

const TYPE_RANK: Record<AlertType, number> = {
  COLD_EXCURSION: 0,
  LOT_EXPIRED: 1,
  COLD_WARNING: 2,
  TRUCK_DELAYED: 3,
  DOCK_BLOCKED: 4,
  LOT_EXPIRING: 5,
  SHIPMENT_LATE: 6,
  FORKLIFT_BATTERY: 7,
};

const CATEGORY: Record<AlertType, AlertCategory> = {
  COLD_EXCURSION: "cold",
  COLD_WARNING: "cold",
  LOT_EXPIRED: "expiry",
  LOT_EXPIRING: "expiry",
  TRUCK_DELAYED: "ops",
  DOCK_BLOCKED: "ops",
  FORKLIFT_BATTERY: "ops",
  SHIPMENT_LATE: "shipping",
};

/** Derive a prioritized alert list from the current world state. */
export function deriveAlerts(world: World): Alert[] {
  const alerts: Alert[] = [];
  const push = (type: AlertType, severity: Severity, siteId: SiteId, ref: ObjectRef, title: string, nextStep: string) =>
    alerts.push({ id: `${type}:${ref.id}`, type, category: CATEGORY[type], severity, siteId, ref, title, nextStep });

  for (const site of world.sites) {
    for (const room of site.coldRooms) {
      if (room.status === "excursion") {
        push(
          "COLD_EXCURSION",
          "high",
          site.id,
          { kind: "coldRoom", id: room.id },
          `${room.label} excursion at ${formatTemp(room.currentC)}`,
          "Quarantine affected lots and call QA before release.",
        );
      } else if (room.status === "warning") {
        push(
          "COLD_WARNING",
          "medium",
          site.id,
          { kind: "coldRoom", id: room.id },
          `${room.label} drifting warm at ${formatTemp(room.currentC)}`,
          "Check the compressor and door seals before it becomes an excursion.",
        );
      }
    }
    for (const truck of site.trucks) {
      if (truck.kind === "reefer" && truck.tempC !== undefined) {
        if (truck.tempStatus === "excursion") {
          push(
            "COLD_EXCURSION",
            "high",
            site.id,
            { kind: "truck", id: truck.id },
            `Reefer ${truck.id} excursion at ${formatTemp(truck.tempC)}`,
            "Hold the load, download the logger and get a QA disposition.",
          );
        } else if (truck.tempStatus === "warning") {
          push(
            "COLD_WARNING",
            "medium",
            site.id,
            { kind: "truck", id: truck.id },
            `Reefer ${truck.id} warming at ${formatTemp(truck.tempC)}`,
            "Close doors between pallets and check the reefer unit.",
          );
        }
      }
      if (truck.delayMinutes > TRUCK_DELAY_ALERT_MINUTES) {
        const waiting = truck.location === "yard";
        push(
          "TRUCK_DELAYED",
          truck.delayMinutes > 180 ? "high" : "medium",
          site.id,
          { kind: "truck", id: truck.id },
          `${truck.id} ${waiting ? "waiting for a dock" : "running late"} (${formatMinutes(truck.delayMinutes)})`,
          waiting ? "Free a dock or re-sequence the yard." : "Confirm a new ETA with the carrier and warn receiving.",
        );
      }
    }
    for (const dock of site.docks) {
      if (dock.status === "blocked") {
        push(
          "DOCK_BLOCKED",
          "medium",
          site.id,
          { kind: "dock", id: dock.id },
          `${dock.label} blocked`,
          "Chase the maintenance ticket and reroute appointments.",
        );
      }
    }
    for (const f of site.forklifts) {
      if (f.battery < FORKLIFT_CRITICAL_BATTERY) {
        const charging = f.status === "charging";
        push(
          "FORKLIFT_BATTERY",
          charging ? "low" : "medium",
          site.id,
          { kind: "forklift", id: f.id },
          `${f.id} battery ${Math.round(f.battery)}%${charging ? ", charging" : ""}`,
          charging ? "Plan around one fewer forklift for the next hour." : "Send it to charge before it stalls in an aisle.",
        );
      }
    }
    for (const bay of site.bays) {
      for (const lot of bay.lots) {
        if (lot.qty <= 0) continue;
        const status = classifyExpiry(lot.expiresOn, world.today);
        const days = daysToExpiry(lot.expiresOn, world.today);
        const name = productName(lot.sku);
        if (status === "expired") {
          push(
            "LOT_EXPIRED",
            "high",
            site.id,
            { kind: "lot", id: lot.lotId },
            `Expired lot ${lot.lotId} still in ${bay.label}`,
            `Move ${lot.qty} × ${name} to quarantine and block it from picking.`,
          );
        } else if (status === "critical") {
          push(
            "LOT_EXPIRING",
            days <= 7 ? "high" : "medium",
            site.id,
            { kind: "lot", id: lot.lotId },
            `Lot ${lot.lotId} expires in ${days} ${days === 1 ? "day" : "days"}`,
            `Prioritize ${name} for picking or plan a write-off.`,
          );
        }
      }
    }
  }

  for (const s of world.shipments) {
    if (s.deliveredOn) continue;
    const late = daysBetween(s.promisedBy, world.today);
    if (late <= 0 || late > LATE_SHIPMENT_WINDOW_DAYS) continue;
    push(
      "SHIPMENT_LATE",
      late > 7 ? "medium" : "low",
      s.fromSite,
      { kind: "shipment", id: s.shipmentId },
      `${s.shipmentId} ${late} ${late === 1 ? "day" : "days"} past promise`,
      s.shippedOn ? "Get a proof-of-delivery or tracking update from the carrier." : "Confirm stock and get it on the next truck.",
    );
  }

  return alerts.sort(
    (a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || TYPE_RANK[a.type] - TYPE_RANK[b.type] || a.id.localeCompare(b.id),
  );
}
