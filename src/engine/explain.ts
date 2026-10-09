import { formatMinutes, formatMoney, formatTemp } from "../lib/format";
import { productName } from "../sim/products";
import { resolveRef } from "../sim/lookup";
import type { World } from "../sim/types";
import type { Alert } from "./alerts";
import { daysToExpiry } from "./expiry";
import type { ReconException } from "./reconcile";

export interface Explanation {
  /** At most two hedged sentences. */
  text: string;
  nextStep: string;
}

/** Rules-based, plain-English explanation of an alert. Always hedged: it reads data, not minds. */
export function explainAlert(alert: Alert, world: World): Explanation {
  const r = resolveRef(world, alert.ref);
  switch (alert.type) {
    case "COLD_EXCURSION":
      if (r?.kind === "truck") {
        return {
          text: `Reefer ${r.truck.id} has likely been at the dock with doors open too long in a ${r.site.ambientC}°C yard. Product inside is possibly compromised until QA reviews the logger data.`,
          nextStep: alert.nextStep,
        };
      }
      return {
        text: `The room has been more than 4°C off setpoint, which likely means a door left open or a failing unit. Lots stored inside are possibly out of specification.`,
        nextStep: alert.nextStep,
      };
    case "COLD_WARNING":
      if (r?.kind === "coldRoom") {
        const first = r.room.history[0];
        const trend =
          first !== undefined && r.room.currentC - first > 1
            ? "has been climbing steadily over the last 12 hours"
            : "is sitting above setpoint";
        return {
          text: `${r.room.label} ${trend}, which is likely an equipment issue rather than a one-off door opening. It is possibly a few hours from an excursion if nothing changes.`,
          nextStep: alert.nextStep,
        };
      }
      return {
        text: `The reading is 2–4°C off setpoint, likely from extended door-open time. It may recover on its own once loading stops.`,
        nextStep: alert.nextStep,
      };
    case "LOT_EXPIRED":
      if (r?.kind === "lot") {
        return {
          text: `Lot ${r.lot.lotId} expired ${-daysToExpiry(r.lot.expiresOn, world.today)} days ago but still shows ${r.lot.qty} units in a pickable bay. It was likely missed by the expiry sweep and could possibly be picked by mistake.`,
          nextStep: alert.nextStep,
        };
      }
      break;
    case "LOT_EXPIRING":
      if (r?.kind === "lot") {
        return {
          text: `${productName(r.lot.sku)} lot ${r.lot.lotId} has ${daysToExpiry(r.lot.expiresOn, world.today)} days left, which is likely too short for most customers' receiving rules. Without action it will possibly become a write-off.`,
          nextStep: alert.nextStep,
        };
      }
      break;
    case "TRUCK_DELAYED":
      if (r?.kind === "truck") {
        const waiting = r.truck.location === "yard";
        return {
          text: waiting
            ? `${r.truck.id} has likely been waiting ${formatMinutes(r.truck.delayMinutes)} because every ${r.truck.direction} dock is busy or blocked. Detention charges are possibly accruing.`
            : `${r.truck.id} is running about ${formatMinutes(r.truck.delayMinutes)} behind, likely from traffic or a late departure. Receiving labor is possibly scheduled for the wrong slot.`,
          nextStep: alert.nextStep,
        };
      }
      break;
    case "DOCK_BLOCKED":
      if (r?.kind === "dock") {
        return {
          text: `${r.dock.label} is out of service${r.dock.note ? ` (${r.dock.note.replace(/\.$/, "").toLowerCase()})` : ""}. This likely pushes trucks into the yard queue during peak hours.`,
          nextStep: alert.nextStep,
        };
      }
      break;
    case "FORKLIFT_BATTERY":
      return {
        text: `The battery is low, likely after a long shift without a charge. Pick and putaway throughput is possibly reduced until it is back.`,
        nextStep: alert.nextStep,
      };
    case "SHIPMENT_LATE":
      if (r?.kind === "shipment") {
        return {
          text: r.shipment.shippedOn
            ? `The shipment left but has not been confirmed delivered, so it is likely stuck in transit or missing a proof of delivery. The customer has possibly noticed already.`
            : `Nothing has shipped yet against a promise date that has passed, likely a stock or allocation problem. The customer has possibly been told a date we cannot keep.`,
          nextStep: alert.nextStep,
        };
      }
      break;
  }
  return { text: "This looks like an operational issue worth a closer look.", nextStep: alert.nextStep };
}

/** Rules-based explanation for an order-to-cash exception. */
export function explainException(e: ReconException): Explanation {
  const amt = formatMoney(e.dollarImpact);
  switch (e.type) {
    case "SHIPPED_NOT_INVOICED":
      return {
        text: `Goods left ${e.daysOpen} days ago but no invoice exists, so ${amt} of revenue is likely unbilled. The invoice trigger was possibly skipped or failed silently.`,
        nextStep: "Raise the invoice from the shipment record and check why the trigger did not fire.",
      };
    case "PRICE_MISMATCH":
      return {
        text: `The invoiced unit price differs from the order price, likely from a stale price list or a manual override. The ${amt} gap is possibly a dispute or a margin leak.`,
        nextStep: "Confirm which price is contractually right and issue a credit or rebill.",
      };
    case "QTY_MISMATCH":
      return {
        text: `Fewer units were invoiced than shipped, so about ${amt} is likely under-billed. A partial pick may possibly have been keyed against the invoice instead of the shipment.`,
        nextStep: "Rebill the missing units after confirming the proof of delivery.",
      };
    case "BILLED_MORE_THAN_SHIPPED":
      return {
        text: `The customer was billed for more units than shipped, which will likely come back as a short-pay or dispute. ${amt} is possibly overstated in receivables.`,
        nextStep: "Issue a credit memo for the difference before the customer disputes it.",
      };
    case "INVOICE_WITHOUT_SHIPMENT":
      return {
        text: `An invoice exists but nothing has shipped, so ${amt} of revenue is likely recognized early. This is possibly a pre-bill that was never fulfilled.`,
        nextStep: "Either ship now or reverse the invoice, and check the revenue recognition rule.",
      };
    case "NEVER_SHIPPED_AGED":
      return {
        text: `The order is ${e.daysOpen} days old with nothing shipped, likely stuck on allocation or a credit hold. ${amt} of demand is possibly about to cancel.`,
        nextStep: "Find the blocker (stock, credit, or address) and call the customer.",
      };
    case "EXPIRY_RISK_SHIPMENT":
      return {
        text: `A lot was shipped expired or within 30 days of expiry, which likely breaches the customer's shelf-life terms. ${amt} of product is possibly returnable.`,
        nextStep: "Contact the customer and check whether FEFO picking was bypassed.",
      };
    case "DUPLICATE_INVOICE":
      return {
        text: `The same lines were invoiced twice, likely from a retry or a manual re-send. ${amt} is possibly double-counted in receivables.`,
        nextStep: "Void the duplicate invoice and tell the customer which one to pay.",
      };
  }
}

/** One-line status summary for cold-chain readings in detail panels. */
export function describeTemp(currentC: number, setpointC: number): string {
  const d = currentC - setpointC;
  if (Math.abs(d) < 0.5) return `${formatTemp(currentC)}, on setpoint`;
  return `${formatTemp(currentC)}, ${Math.abs(d).toFixed(1)}°C ${d > 0 ? "above" : "below"} setpoint`;
}
