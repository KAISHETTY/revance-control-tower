import { AnimatePresence, motion } from "framer-motion";
import { BatteryCharging, Lightbulb, MapPin, Thermometer, X } from "lucide-react";
import { lazy, Suspense, type ReactNode } from "react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import type { Alert } from "../engine/alerts";
import { classifyExpiry, daysToExpiry, worstExpiry } from "../engine/expiry";
import { describeTemp, explainAlert } from "../engine/explain";
import { cn } from "../lib/cn";
import { formatLongDate, formatShortDate } from "../lib/dates";
import { formatInt, formatMinutes, formatMoney, formatPct, formatTemp } from "../lib/format";
import { findTruck, resolveRef, siteName, type Resolved } from "../sim/lookup";
import { productBySku, productName } from "../sim/products";
import type { Lot, ObjectRef, Shipment, World } from "../sim/types";
import { useAlerts, useKpis } from "../store/derived";
import { useWorld } from "../store/useWorld";
import {
  COLD_LABEL,
  COLD_TONE,
  DOCK_LABEL,
  DOCK_TONE,
  EXPIRY_LABEL,
  EXPIRY_TONE,
  FORKLIFT_LABEL,
  TRUCK_STATUS_LABEL,
  TRUCK_STATUS_TONE,
} from "./labels";

const Sparkline = lazy(() => import("./Sparkline"));

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <dt className="shrink-0 text-muted">{label}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

function LinkButton({ children, onClick, label }: { children: ReactNode; onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </button>
  );
}

function LotList({ lots, today }: { lots: Lot[]; today: string }) {
  const select = useWorld((s) => s.select);
  if (lots.length === 0) return <p className="text-sm text-muted">This bay is empty.</p>;
  return (
    <ul className="divide-y divide-line rounded-lg border border-line">
      {lots.map((lot) => {
        const status = classifyExpiry(lot.expiresOn, today);
        const days = daysToExpiry(lot.expiresOn, today);
        return (
          <li key={lot.lotId}>
            <button
              type="button"
              onClick={() => select({ kind: "lot", id: lot.lotId })}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-panel-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{productName(lot.sku)}</span>
                <span className="block text-xs text-muted">
                  {lot.lotId} · {formatInt(lot.qty)} units · exp {formatShortDate(lot.expiresOn)}
                </span>
              </span>
              <Badge tone={EXPIRY_TONE[status]}>{status === "ok" ? `${days}d` : days < 0 ? `${-days}d ago` : `${days}d left`}</Badge>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function ShipmentBlock({ shipment, world }: { shipment: Shipment; world: World }) {
  const openOrder = useWorld((s) => s.openOrder);
  const order = world.orders.find((o) => o.orderId === shipment.orderId);
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="font-medium">{shipment.shipmentId}</span>
        <LinkButton onClick={() => openOrder(shipment.orderId)} label={`Open order ${shipment.orderId}`}>
          {shipment.orderId}
        </LinkButton>
      </div>
      {order ? <p className="text-xs text-muted">{order.customer}</p> : null}
      <ul className="mt-2 space-y-1">
        {shipment.lines.map((l) => {
          const rec = world.lotCatalog[l.lotId];
          return (
            <li key={`${l.sku}-${l.lotId}`} className="flex items-baseline justify-between gap-2 text-xs">
              <span className="min-w-0 truncate">
                {formatInt(l.qty)} × {productName(l.sku)}
              </span>
              <span className="shrink-0 text-muted">
                lot {l.lotId}
                {rec ? ` · exp ${formatShortDate(rec.expiresOn)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-xs text-muted">
        {shipment.shippedOn ? `Shipped ${formatShortDate(shipment.shippedOn)}` : "Not shipped yet"} · promised by{" "}
        {formatShortDate(shipment.promisedBy)}
        {shipment.deliveredOn ? ` · delivered ${formatShortDate(shipment.deliveredOn)}` : ""}
      </p>
    </div>
  );
}

function Explanation({ alerts, world }: { alerts: Alert[]; world: World }) {
  if (alerts.length === 0) return null;
  return (
    <div className="space-y-2">
      {alerts.slice(0, 3).map((a) => {
        const ex = explainAlert(a, world);
        return (
          <div key={a.id} className="rounded-lg border border-warn/30 bg-warn/10 p-3" data-testid="explanation">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-warn">
              <Lightbulb className="h-3.5 w-3.5" aria-hidden /> {a.title}
            </p>
            <p className="mt-1 text-sm leading-snug">{ex.text}</p>
            <p className="mt-1.5 text-sm">
              <span className="font-semibold">Next step:</span> {ex.nextStep}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Alerts that concern the selected object or anything inside it. */
function relatedAlerts(alerts: Alert[], r: Resolved): Alert[] {
  const ids = new Set<string>();
  if (r.kind === "bay") r.bay.lots.forEach((l) => ids.add(l.lotId));
  if (r.kind === "dock" && r.dock.truckId) ids.add(r.dock.truckId);
  if (r.kind === "site") return alerts.filter((a) => a.siteId === r.site.id);
  const own =
    r.kind === "truck"
      ? r.truck.id
      : r.kind === "dock"
        ? r.dock.id
        : r.kind === "forklift"
          ? r.forklift.id
          : r.kind === "bay"
            ? r.bay.id
            : r.kind === "coldRoom"
              ? r.room.id
              : r.kind === "lot"
                ? r.lot.lotId
                : r.kind === "shipment"
                  ? r.shipment.shipmentId
                  : r.order.orderId;
  ids.add(own);
  return alerts.filter((a) => ids.has(a.ref.id));
}

function SiteSummary({ r }: { r: Extract<Resolved, { kind: "site" }> }) {
  const k = useKpis(r.site.id);
  return (
    <dl>
      <Row label="Role">{r.site.role}</Row>
      <Row label="Docks">{`${r.site.docks.length} (${k.occupiedDocks} in use)`}</Row>
      <Row label="Trucks on site or inbound">{r.site.trucks.length}</Row>
      <Row label="Stock value">{formatMoney(k.stockValueBySite[r.site.id])}</Row>
      <Row label="On-time delivery">{formatPct(k.onTimeDelivery)}</Row>
      <Row label="Dollars at risk">{formatMoney(k.dollarsAtRisk)}</Row>
      <Row label="Yard temperature">{formatTemp(r.site.ambientC)}</Row>
    </dl>
  );
}

function Body({ r, world }: { r: Resolved; world: World }) {
  const select = useWorld((s) => s.select);
  const resolveTemperature = useWorld((s) => s.resolveTemperature);
  const repairDock = useWorld((s) => s.repairDock);

  switch (r.kind) {
    case "site":
      return <SiteSummary r={r} />;
    case "truck": {
      const t = r.truck;
      const shipment = t.shipmentId ? world.shipments.find((s) => s.shipmentId === t.shipmentId) : undefined;
      const dock = t.dockId ? r.site.docks.find((d) => d.id === t.dockId) : undefined;
      const where =
        t.location === "dock"
          ? `${r.site.shortName}, ${dock?.label ?? "dock"}`
          : t.location === "yard"
            ? `${r.site.shortName} yard, waiting for a ${t.direction} dock`
            : `${t.originSiteId ? siteName(world, t.originSiteId) : "Supplier"} → ${r.site.shortName}`;
      return (
        <>
          <dl>
            <Row label="Carrier">{t.carrier}</Row>
            <Row label="Type">{t.kind === "reefer" ? "Reefer (temperature controlled)" : "Dry van"}</Row>
            <Row label="Location">{where}</Row>
            {t.location === "road" ? <Row label="ETA">{formatMinutes(t.etaMinutes)}</Row> : null}
            {t.location === "dock" ? <Row label="At dock for">{formatMinutes(t.dwellMinutes)}</Row> : null}
            {t.location === "dock" ? (
              <Row label={t.status === "loading" ? "Loading done in" : "Unloading done in"}>{formatMinutes(t.taskMinutes)}</Row>
            ) : null}
            {t.delayMinutes > 0 ? (
              <Row label="Delay">
                <span className="text-warn">{formatMinutes(t.delayMinutes)}</span>
              </Row>
            ) : null}
            {t.kind === "reefer" && t.tempC !== undefined && t.setpointC !== undefined ? (
              <Row label="Box temperature">
                <span className="inline-flex items-center gap-1.5" data-testid="truck-temp">
                  <Thermometer className="h-3.5 w-3.5 text-muted" aria-hidden />
                  {describeTemp(t.tempC, t.setpointC)}
                  <Badge tone={COLD_TONE[t.tempStatus ?? "ok"]}>{COLD_LABEL[t.tempStatus ?? "ok"]}</Badge>
                </span>
              </Row>
            ) : null}
          </dl>
          {t.kind === "reefer" && t.tempStatus && t.tempStatus !== "ok" ? (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                resolveTemperature({ kind: "truck", id: t.id });
                toast.success(`${t.id}: corrective action logged, temperature back in range`);
              }}
            >
              Log corrective action
            </Button>
          ) : null}
          {shipment ? (
            <Section title="Shipment on board">
              <div data-testid="truck-shipment">
                <ShipmentBlock shipment={shipment} world={world} />
              </div>
            </Section>
          ) : null}
        </>
      );
    }
    case "dock": {
      const d = r.dock;
      return (
        <>
          <dl>
            <Row label="Type">{d.type === "inbound" ? "Inbound (receiving)" : "Outbound (shipping)"}</Row>
            <Row label="Status">
              <Badge tone={DOCK_TONE[d.status]}>{DOCK_LABEL[d.status]}</Badge>
            </Row>
            {d.truckId ? (
              <Row label="Truck">
                <LinkButton onClick={() => select({ kind: "truck", id: d.truckId! })}>{d.truckId}</LinkButton>
              </Row>
            ) : null}
            {d.note ? <Row label="Note">{d.note}</Row> : null}
          </dl>
          {d.status === "blocked" ? (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                repairDock(d.id);
                toast.success(`${d.label} marked repaired and back in service`);
              }}
            >
              Mark repaired
            </Button>
          ) : null}
        </>
      );
    }
    case "bay": {
      const b = r.bay;
      const value = b.lots.reduce((a, l) => a + l.qty * productBySku(l.sku).unitPrice, 0);
      const status = worstExpiry(b.lots, world.today);
      return (
        <>
          <dl>
            <Row label="Zone">{b.zone === "cold" ? "Cold (2–8°C)" : b.zone === "quarantine" ? "Quarantine (on hold)" : "Ambient"}</Row>
            <Row label="Stock value">{formatMoney(value)}</Row>
            <Row label="Worst expiry">
              <Badge tone={EXPIRY_TONE[status]}>{EXPIRY_LABEL[status]}</Badge>
            </Row>
            {b.coldRoomId ? (
              <Row label="Inside">
                <LinkButton onClick={() => select({ kind: "coldRoom", id: b.coldRoomId! })}>
                  {r.site.coldRooms.find((c) => c.id === b.coldRoomId)?.label}
                </LinkButton>
              </Row>
            ) : null}
          </dl>
          <Section title="Lots">
            <LotList lots={b.lots} today={world.today} />
          </Section>
        </>
      );
    }
    case "lot": {
      const l = r.lot;
      const status = classifyExpiry(l.expiresOn, world.today);
      const days = daysToExpiry(l.expiresOn, world.today);
      const p = productBySku(l.sku);
      return (
        <>
          <dl>
            <Row label="Product">{p.name}</Row>
            <Row label="Quantity">{formatInt(l.qty)} units</Row>
            <Row label="Value">{formatMoney(l.qty * p.unitPrice)}</Row>
            <Row label="Received">{formatLongDate(l.receivedOn)}</Row>
            <Row label="Expires">
              <span className="inline-flex items-center gap-1.5">
                {formatLongDate(l.expiresOn)}
                <Badge tone={EXPIRY_TONE[status]}>{days < 0 ? `expired ${-days}d ago` : `${days}d left`}</Badge>
              </span>
            </Row>
            <Row label="Location">
              <LinkButton onClick={() => select({ kind: "bay", id: r.bay.id })}>
                {r.site.shortName} · bay {r.bay.label}
              </LinkButton>
            </Row>
            <Row label="Storage">{p.coldChain ? "Cold chain, 2–8°C" : "Ambient"}</Row>
          </dl>
        </>
      );
    }
    case "coldRoom": {
      const c = r.room;
      const bays = r.site.bays.filter((b) => b.coldRoomId === c.id);
      return (
        <>
          <dl>
            <Row label="Now">
              <span className="inline-flex items-center gap-1.5" data-testid="room-temp">
                {describeTemp(c.currentC, c.setpointC)}
                <Badge tone={COLD_TONE[c.status]}>{COLD_LABEL[c.status]}</Badge>
              </span>
            </Row>
            <Row label="Setpoint">{`${formatTemp(c.setpointC)} (range 2–8°C)`}</Row>
            <Row label="Bays inside">{bays.map((b) => b.label).join(", ") || "None"}</Row>
          </dl>
          <Section title="Last 12 hours">
            <Suspense fallback={<div className="skeleton h-28 rounded-lg" />}>
              <Sparkline values={c.history} setpoint={c.setpointC} />
            </Suspense>
          </Section>
          {c.status !== "ok" ? (
            <Button
              variant="subtle"
              size="sm"
              onClick={() => {
                resolveTemperature({ kind: "coldRoom", id: c.id });
                toast.success(`${c.label}: corrective action logged`);
              }}
            >
              Log corrective action
            </Button>
          ) : null}
        </>
      );
    }
    case "forklift": {
      const f = r.forklift;
      const tone = f.battery < 15 ? "bg-bad" : f.battery < 35 ? "bg-warn" : "bg-ok";
      return (
        <dl>
          <Row label="Status">{FORKLIFT_LABEL[f.status]}</Row>
          <Row label="Battery">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-24 overflow-hidden rounded-full bg-panel-2" aria-hidden>
                <span className={cn("block h-full", tone)} style={{ width: `${f.battery}%` }} />
              </span>
              <span className="tabular">{Math.round(f.battery)}%</span>
              {f.status === "charging" ? <BatteryCharging className="h-4 w-4 text-ok" aria-label="Charging" /> : null}
            </span>
          </Row>
          {f.targetId ? <Row label="Heading to">{f.targetId.replace(`${r.site.id}-`, "").replace("CHG", "charger")}</Row> : null}
        </dl>
      );
    }
    case "shipment":
      return (
        <>
          <ShipmentBlock shipment={r.shipment} world={world} />
          {r.shipment.truckId && findTruck(world, r.shipment.truckId) ? (
            <Button variant="subtle" size="sm" onClick={() => select({ kind: "truck", id: r.shipment.truckId! })}>
              Show truck {r.shipment.truckId}
            </Button>
          ) : null}
        </>
      );
    case "order":
      return <p className="text-sm text-muted">Order details open in the order drawer.</p>;
  }
}

function titleFor(r: Resolved): { title: string; subtitle: string; badge?: ReactNode } {
  switch (r.kind) {
    case "site":
      return { title: r.site.name, subtitle: "Site overview" };
    case "truck":
      return {
        title: r.truck.id,
        subtitle: `${r.truck.kind === "reefer" ? "Reefer" : "Dry van"} · ${r.truck.direction}`,
        badge: <Badge tone={TRUCK_STATUS_TONE[r.truck.status]}>{TRUCK_STATUS_LABEL[r.truck.status]}</Badge>,
      };
    case "dock":
      return {
        title: r.dock.label,
        subtitle: r.site.shortName,
        badge: <Badge tone={DOCK_TONE[r.dock.status]}>{DOCK_LABEL[r.dock.status]}</Badge>,
      };
    case "bay":
      return { title: `Bay ${r.bay.label}`, subtitle: `${r.site.shortName} · ${r.bay.lots.length} lots` };
    case "lot":
      return { title: `Lot ${r.lot.lotId}`, subtitle: productName(r.lot.sku) };
    case "coldRoom":
      return {
        title: r.room.label,
        subtitle: r.site.shortName,
        badge: <Badge tone={COLD_TONE[r.room.status]}>{COLD_LABEL[r.room.status]}</Badge>,
      };
    case "forklift":
      return { title: `Forklift ${r.forklift.id.split("-").pop()}`, subtitle: r.site.shortName };
    case "shipment":
      return { title: `Shipment ${r.shipment.shipmentId}`, subtitle: `From ${r.site.shortName}` };
    case "order":
      return { title: r.order.orderId, subtitle: r.order.customer };
  }
}

export function DetailContent({ selection }: { selection: ObjectRef }) {
  const world = useWorld((s) => s.world);
  const alerts = useAlerts();
  const select = useWorld((s) => s.select);
  const r = resolveRef(world, selection);
  if (!r) {
    return <p className="p-4 text-sm text-muted">This object has left the area. Pick another one from the map or the lists.</p>;
  }
  const { title, subtitle, badge } = titleFor(r);
  const related = relatedAlerts(alerts, r);
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2 pr-8">
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold" data-testid="detail-title">
            {title}
          </h2>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
        {badge}
      </div>
      {r.kind !== "site" ? (
        <Explanation alerts={related} world={world} />
      ) : related.length ? (
        <p className="text-sm text-muted">{related.length} open alerts at this site. Pick one from the feed for details.</p>
      ) : null}
      <Body r={r} world={world} />
      {r.kind !== "site" ? (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          onClick={() => select({ kind: "site", id: r.site.id })}
        >
          <MapPin className="h-3 w-3" aria-hidden /> {r.site.name}
        </button>
      ) : null}
    </div>
  );
}

/** Floating card over the viewport on desktop, bottom sheet on mobile. */
export function DetailPanel() {
  const selection = useWorld((s) => s.selection);
  const select = useWorld((s) => s.select);
  return (
    <AnimatePresence>
      {selection ? (
        <motion.aside
          key="detail"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          aria-label="Details"
          data-testid="detail-panel"
          className={cn(
            "scrollbar-thin fixed inset-x-0 bottom-0 z-30 max-h-[62dvh] overflow-y-auto rounded-t-2xl border-t border-line bg-panel/95 p-4 shadow-2xl backdrop-blur",
            "lg:absolute lg:inset-x-auto lg:bottom-3 lg:left-3 lg:max-h-[calc(100%-1.5rem)] lg:w-[360px] lg:rounded-xl lg:border",
          )}
        >
          <button
            type="button"
            onClick={() => select(null)}
            className="absolute top-3 right-3 rounded-md p-1.5 text-muted hover:bg-panel-2 hover:text-fg"
            aria-label="Close details"
            data-testid="detail-close"
          >
            <X className="h-4 w-4" />
          </button>
          <DetailContent selection={selection} />
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}
