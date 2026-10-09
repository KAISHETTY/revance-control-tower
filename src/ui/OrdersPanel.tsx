import { ArrowDown, ArrowUp, Download, MapPin, SearchX } from "lucide-react";
import { lazy, Suspense, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Sheet } from "../components/ui/sheet";
import { explainException } from "../engine/explain";
import {
  EXCEPTION_LABELS,
  EXPIRY_RISK_DAYS,
  EXCEPTION_TYPES,
  SEVERITY_RANK,
  type ExceptionType,
  type ReconException,
  type Severity,
} from "../engine/reconcile";
import { cn } from "../lib/cn";
import { toCsv } from "../lib/csv";
import { daysBetween, formatShortDate } from "../lib/dates";
import { formatInt, formatMoney, formatMoneyExact } from "../lib/format";
import { siteName } from "../sim/lookup";
import { productName } from "../sim/products";
import type { Channel } from "../sim/types";
import { useExceptions, useReconSummary } from "../store/derived";
import { useWorld } from "../store/useWorld";
import { SEVERITY_LABEL, SEVERITY_TONE } from "./labels";

const ExceptionChart = lazy(() => import("./ExceptionChart"));

type SortKey = "orderId" | "type" | "dollarImpact" | "daysOpen" | "severity" | "channel";

const selectCls = "h-8 rounded-md border border-line bg-panel px-2 text-xs text-fg";

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function OrdersPanel() {
  const exceptions = useExceptions();
  const summary = useReconSummary();
  const world = useWorld((s) => s.world);
  const openOrder = useWorld((s) => s.openOrder);
  const [type, setType] = useState<ExceptionType | "all">("all");
  const [severity, setSeverity] = useState<Severity | "all">("all");
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [minDollars, setMinDollars] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "severity", dir: 1 });

  const rows = useMemo(() => {
    const min = Number(minDollars) || 0;
    const q = query.trim().toUpperCase();
    const filtered = exceptions.filter(
      (e) =>
        (type === "all" || e.type === type) &&
        (severity === "all" || e.severity === severity) &&
        (channel === "all" || e.channel === channel) &&
        e.dollarImpact >= min &&
        (!q || e.orderId.toUpperCase().includes(q) || e.customer.toUpperCase().includes(q)),
    );
    const val = (e: ReconException): string | number =>
      sort.key === "severity"
        ? SEVERITY_RANK[e.severity] * 1e9 - e.dollarImpact
        : sort.key === "type"
          ? EXCEPTION_LABELS[e.type]
          : e[sort.key];
    return filtered.slice().sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      return (va < vb ? -1 : va > vb ? 1 : 0) * sort.dir;
    });
  }, [exceptions, type, severity, channel, minDollars, query, sort]);

  const total = rows.reduce((a, r) => a + r.dollarImpact, 0);
  const setSortKey = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "dollarImpact" || key === "daysOpen" ? -1 : 1 },
    );
  const SortHead = ({ k, label, className }: { k: SortKey; label: string; className?: string }) => (
    <th
      scope="col"
      className={cn("px-2 py-2 font-medium", className)}
      aria-sort={sort.key === k ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => setSortKey(k)}
        className="inline-flex items-center gap-1 hover:text-fg"
        data-testid={`sort-${k}`}
      >
        {label}
        {sort.key === k ? (
          sort.dir === 1 ? (
            <ArrowUp className="h-3 w-3" aria-hidden />
          ) : (
            <ArrowDown className="h-3 w-3" aria-hidden />
          )
        ) : null}
      </button>
    </th>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line px-3 py-2.5">
        <p className="text-xs text-muted">
          Three-way match of {formatInt(world.orders.length)} orders against shipments and invoices.{" "}
          <span className="text-fg">{formatInt(summary.exceptions)} exceptions</span>, {formatMoney(summary.dollarsAtRisk)} at risk.
        </p>
        <Suspense fallback={<div className="skeleton h-24 rounded-lg" />}>
          <ExceptionChart summary={summary} onPick={(t) => setType((cur) => (cur === t ? "all" : t))} active={type} />
        </Suspense>
        <div className="flex flex-wrap items-center gap-1.5">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search order ID or customer"
            aria-label="Search by order ID or customer"
            data-testid="orders-search"
            className="h-8 min-w-0 flex-1 basis-40 rounded-md border border-line bg-panel px-2.5 text-xs text-fg placeholder:text-muted"
          />
          <select
            aria-label="Exception type"
            className={selectCls}
            value={type}
            onChange={(e) => setType(e.target.value as ExceptionType | "all")}
            data-testid="filter-type"
          >
            <option value="all">All types</option>
            {EXCEPTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {EXCEPTION_LABELS[t]}
              </option>
            ))}
          </select>
          <select
            aria-label="Severity"
            className={selectCls}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity | "all")}
            data-testid="filter-severity"
          >
            <option value="all">Any severity</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <select
            aria-label="Channel"
            className={selectCls}
            value={channel}
            onChange={(e) => setChannel(e.target.value as Channel | "all")}
            data-testid="filter-channel"
          >
            <option value="all">All channels</option>
            <option value="Practice">Practice</option>
            <option value="Retail">Retail</option>
            <option value="Web">Web</option>
          </select>
          <label className="flex items-center gap-1 text-xs text-muted">
            Min $
            <input
              type="number"
              min={0}
              step={100}
              inputMode="numeric"
              value={minDollars}
              onChange={(e) => setMinDollars(e.target.value)}
              aria-label="Minimum dollar impact"
              data-testid="filter-min"
              className="h-8 w-20 rounded-md border border-line bg-panel px-2 text-xs text-fg"
            />
          </label>
        </div>
        <div className="flex items-center justify-between text-xs text-muted">
          <span data-testid="orders-count">
            {rows.length} shown · {formatMoney(total)}
          </span>
          <Button
            size="sm"
            variant="outline"
            data-testid="export-csv"
            disabled={rows.length === 0}
            onClick={() => {
              download(`order-to-cash-exceptions-${world.today}.csv`, toCsv(rows));
              toast.success(`Exported ${rows.length} exceptions`);
            }}
          >
            <Download className="h-3.5 w-3.5" aria-hidden /> Export CSV
          </Button>
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
            <SearchX className="h-6 w-6" aria-hidden />
            <p>No exceptions match these filters.</p>
          </div>
        ) : (
          <>
            <table className="hidden w-full text-left text-xs sm:table" data-testid="orders-table">
              <thead className="sticky top-0 z-10 bg-panel text-muted">
                <tr className="border-b border-line">
                  <SortHead k="orderId" label="Order" className="pl-3" />
                  <SortHead k="type" label="Exception" />
                  <SortHead k="channel" label="Channel" />
                  <SortHead k="dollarImpact" label="Impact" className="text-right" />
                  <SortHead k="daysOpen" label="Days" className="text-right" />
                  <SortHead k="severity" label="Severity" className="pr-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="cursor-pointer border-b border-line/60 hover:bg-panel-2"
                    onClick={() => openOrder(r.orderId)}
                    data-testid="order-row"
                  >
                    <td className="py-2 pr-2 pl-3">
                      <button
                        type="button"
                        className="font-mono font-medium text-accent hover:underline"
                        onClick={(e) => (e.stopPropagation(), openOrder(r.orderId))}
                      >
                        {r.orderId}
                      </button>
                      <div className="max-w-[140px] truncate text-[11px] text-muted">{r.customer}</div>
                    </td>
                    <td className="px-2 py-2">{EXCEPTION_LABELS[r.type]}</td>
                    <td className="px-2 py-2 text-muted">{r.channel}</td>
                    <td className="tabular px-2 py-2 text-right font-medium" data-testid="row-impact">
                      {formatMoney(r.dollarImpact)}
                    </td>
                    <td className="tabular px-2 py-2 text-right text-muted">{r.daysOpen}</td>
                    <td className="py-2 pr-3 pl-2">
                      <Badge tone={SEVERITY_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="space-y-1.5 p-3 sm:hidden" aria-label="Exceptions">
              {rows.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => openOrder(r.orderId)}
                    className="w-full rounded-lg border border-line bg-panel p-3 text-left"
                    data-testid="order-card"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm font-medium text-accent">{r.orderId}</span>
                      <Badge tone={SEVERITY_TONE[r.severity]}>{SEVERITY_LABEL[r.severity]}</Badge>
                    </div>
                    <div className="mt-1 text-sm">{EXCEPTION_LABELS[r.type]}</div>
                    <div className="mt-0.5 flex justify-between text-xs text-muted">
                      <span className="truncate">
                        {r.customer} · {r.channel}
                      </span>
                      <span className="tabular shrink-0 font-medium text-fg">
                        {formatMoney(r.dollarImpact)} · {r.daysOpen}d
                      </span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

/** Order vs shipment vs invoice, side by side, with mismatches highlighted. */
export function OrderDrawer() {
  const orderId = useWorld((s) => s.orderDrawer);
  const openOrder = useWorld((s) => s.openOrder);
  const select = useWorld((s) => s.select);
  const world = useWorld((s) => s.world);
  const exceptions = useExceptions();
  const order = orderId ? world.orders.find((o) => o.orderId === orderId) : undefined;

  const content = useMemo(() => {
    if (!order) return null;
    const shipments = world.shipments.filter((s) => s.orderId === order.orderId);
    const invoices = world.invoices.filter((i) => i.orderId === order.orderId).sort((a, b) => a.invoicedOn.localeCompare(b.invoicedOn));
    const shipped = shipments.filter((s) => s.shippedOn);
    const skus = [
      ...new Set([
        ...order.lines.map((l) => l.sku),
        ...shipped.flatMap((s) => s.lines.map((l) => l.sku)),
        ...invoices.flatMap((i) => i.lines.map((l) => l.sku)),
      ]),
    ];
    const rows = skus.map((sku) => {
      const o = order.lines.find((l) => l.sku === sku);
      const sLines = shipped.flatMap((s) => s.lines.filter((l) => l.sku === sku));
      const sQty = sLines.reduce((a, l) => a + l.qty, 0);
      const inv = invoices[0]?.lines.find((l) => l.sku === sku);
      const lots = sLines.map((l) => {
        const rec = world.lotCatalog[l.lotId];
        const shippedOn = shipped[0]?.shippedOn;
        const risky = !!rec && !!shippedOn && daysBetween(shippedOn, rec.expiresOn) <= EXPIRY_RISK_DAYS;
        return { lotId: l.lotId, expiresOn: rec?.expiresOn, risky };
      });
      return {
        sku,
        o,
        sQty,
        lots,
        inv,
        priceBad: !!(inv && o && Math.abs(inv.unitPrice - o.unitPrice) > 0.005),
        qtyBad: !!(invoices.length && shipped.length && (inv?.qty ?? 0) !== sQty),
      };
    });
    return { shipments, shipped, invoices, rows, exc: exceptions.filter((e) => e.orderId === order.orderId) };
  }, [order, world, exceptions]);

  const cell = "px-2 py-2 align-top";
  return (
    <Sheet
      open={!!order}
      onOpenChange={(v) => !v && openOrder(null)}
      title={order ? `${order.orderId} · ${order.customer}` : ""}
      description={
        order
          ? `${order.channel} order placed ${formatShortDate(order.orderDate)}, fulfilled from ${siteName(world, order.fulfillmentSite)}`
          : ""
      }
    >
      {order && content ? (
        <div className="space-y-4" data-testid="order-drawer">
          {content.exc.length === 0 ? (
            <p className="rounded-lg border border-ok/30 bg-ok/10 p-3 text-sm">Order, shipment and invoice agree. No exceptions.</p>
          ) : (
            content.exc.map((e) => {
              const ex = explainException(e);
              return (
                <div key={e.id} className="rounded-lg border border-warn/30 bg-warn/10 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{EXCEPTION_LABELS[e.type]}</span>
                    <Badge tone={SEVERITY_TONE[e.severity]}>{SEVERITY_LABEL[e.severity]}</Badge>
                    <span className="tabular text-sm font-semibold">{formatMoneyExact(e.dollarImpact)}</span>
                    <span className="text-xs text-muted">{e.daysOpen} days open</span>
                  </div>
                  <p className="mt-1 text-sm">{ex.text}</p>
                  <p className="mt-1 text-sm">
                    <span className="font-semibold">Next step:</span> {ex.nextStep}
                  </p>
                </div>
              );
            })
          )}

          <div className="overflow-x-auto rounded-lg border border-line">
            <table className="w-full min-w-[560px] text-left text-xs" data-testid="three-way">
              <thead className="bg-panel-2 text-muted">
                <tr>
                  <th scope="col" className={cell}>
                    Product
                  </th>
                  <th scope="col" className={cell}>
                    Ordered
                  </th>
                  <th scope="col" className={cell}>
                    Shipped
                  </th>
                  <th scope="col" className={cell}>
                    Invoiced
                  </th>
                </tr>
              </thead>
              <tbody>
                {content.rows.map((r) => (
                  <tr key={r.sku} className="border-t border-line">
                    <td className={cell}>
                      <div className="font-medium">{productName(r.sku)}</div>
                      <div className="text-muted">{r.sku}</div>
                    </td>
                    <td className={cn(cell, "tabular")}>{r.o ? `${r.o.qty} × ${formatMoneyExact(r.o.unitPrice)}` : "Not ordered"}</td>
                    <td className={cn(cell, "tabular", content.shipped.length && r.o && r.sQty !== r.o.qty && "text-warn")}>
                      {content.shipped.length ? `${r.sQty} units` : <span className="text-muted">Not shipped</span>}
                      {r.lots.map((l) => (
                        <div key={l.lotId} className={cn("text-[11px]", l.risky ? "font-semibold text-bad" : "text-muted")}>
                          lot {l.lotId}
                          {l.expiresOn ? `, exp ${formatShortDate(l.expiresOn)}` : ""}
                        </div>
                      ))}
                    </td>
                    <td className={cn(cell, "tabular")}>
                      {content.invoices.length === 0 ? (
                        <span className="text-muted">Not invoiced</span>
                      ) : r.inv ? (
                        <>
                          <span
                            className={cn(r.qtyBad && "rounded bg-bad/15 px-1 font-semibold text-bad")}
                            data-mismatch={r.qtyBad || undefined}
                          >
                            {r.inv.qty}
                          </span>
                          {" × "}
                          <span
                            className={cn(r.priceBad && "rounded bg-bad/15 px-1 font-semibold text-bad")}
                            data-mismatch={r.priceBad || undefined}
                          >
                            {formatMoneyExact(r.inv.unitPrice)}
                          </span>
                        </>
                      ) : (
                        <span className="font-semibold text-bad">Missing</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div className="rounded-lg border border-line p-3">
              <dt className="font-semibold text-muted uppercase">Order</dt>
              <dd className="mt-1">
                {formatShortDate(order.orderDate)} · {formatMoneyExact(order.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0))}
              </dd>
            </div>
            <div className="rounded-lg border border-line p-3">
              <dt className="font-semibold text-muted uppercase">Shipment</dt>
              <dd className="mt-1 space-y-0.5">
                {content.shipments.length === 0
                  ? "None"
                  : content.shipments.map((s) => (
                      <div key={s.shipmentId}>
                        {s.shipmentId}: {s.shippedOn ? `shipped ${formatShortDate(s.shippedOn)}` : "not shipped"}
                        {s.deliveredOn ? `, delivered ${formatShortDate(s.deliveredOn)}` : ""} (promised {formatShortDate(s.promisedBy)})
                      </div>
                    ))}
              </dd>
            </div>
            <div className="rounded-lg border border-line p-3">
              <dt className="font-semibold text-muted uppercase">Invoices</dt>
              <dd className="mt-1 space-y-0.5">
                {content.invoices.length === 0
                  ? "None"
                  : content.invoices.map((i) => (
                      <div key={i.invoiceId}>
                        {i.invoiceId}: {formatShortDate(i.invoicedOn)},{" "}
                        {formatMoneyExact(i.lines.reduce((a, l) => a + l.qty * l.unitPrice, 0))}
                      </div>
                    ))}
              </dd>
            </div>
          </dl>

          <Button
            variant="subtle"
            size="sm"
            onClick={() => {
              openOrder(null);
              select({ kind: "site", id: order.fulfillmentSite });
            }}
          >
            <MapPin className="h-3.5 w-3.5" aria-hidden /> Show {siteName(world, order.fulfillmentSite)} on the map
          </Button>
        </div>
      ) : null}
    </Sheet>
  );
}
