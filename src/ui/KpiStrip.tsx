import { AlarmClock, CircleDollarSign, PackageCheck, Snowflake, Truck, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { formatInt, formatMinutes, formatMoney, formatPct, plural } from "../lib/format";
import { useFocusSite, useKpis } from "../store/derived";
import { useWorld, type AlertFilter } from "../store/useWorld";

type Tone = "ok" | "warn" | "bad" | "neutral";

interface KpiProps {
  id: string;
  label: string;
  value: string;
  sub: string;
  tone: Tone;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
  hint: string;
}

const toneText: Record<Tone, string> = { ok: "text-ok", warn: "text-warn", bad: "text-bad", neutral: "text-fg" };

function Kpi({ id, label, value, sub, tone, icon, active, onClick, hint }: KpiProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`kpi-${id}`}
      aria-label={`${label}: ${value}. ${sub}. ${hint}`}
      aria-pressed={active}
      className={cn(
        "group flex min-w-[148px] flex-1 snap-start flex-col rounded-xl border bg-panel px-3 py-2.5 text-left transition-colors hover:border-accent/60",
        active ? "border-accent ring-1 ring-accent/40" : "border-line",
      )}
    >
      <span className="flex items-center gap-1.5 text-[11px] font-medium tracking-wide text-muted uppercase">
        <span className="opacity-80" aria-hidden>
          {icon}
        </span>
        {label}
      </span>
      <span className={cn("tabular mt-1 text-xl leading-none font-semibold", toneText[tone])} data-testid={`kpi-${id}-value`}>
        {value}
      </span>
      <span className="mt-1 truncate text-[11px] text-muted">{sub}</span>
    </button>
  );
}

export function KpiStrip() {
  const site = useFocusSite();
  const k = useKpis(site);
  const alertFilter = useWorld((s) => s.alertFilter);
  const tab = useWorld((s) => s.tab);
  const setAlertFilter = useWorld((s) => s.setAlertFilter);
  const setTab = useWorld((s) => s.setTab);
  const toggle = (f: AlertFilter) => setAlertFilter(alertFilter === f && tab === "alerts" ? "all" : f);
  const isActive = (f: AlertFilter) => tab === "alerts" && alertFilter === f;
  const iconCls = "h-3.5 w-3.5";

  return (
    <section aria-label="Key indicators" className="no-scrollbar flex snap-x gap-2 overflow-x-auto px-3 py-2 sm:px-4">
      <Kpi
        id="ontime"
        label="On-time delivery"
        value={formatPct(k.onTimeDelivery)}
        sub={`${formatInt(k.deliveredShipments)} delivered, 90 days`}
        tone={k.onTimeDelivery >= 0.95 ? "ok" : k.onTimeDelivery >= 0.85 ? "warn" : "bad"}
        icon={<Truck className={iconCls} />}
        active={isActive("shipping")}
        onClick={() => toggle("shipping")}
        hint="Shows shipping alerts"
      />
      <Kpi
        id="docks"
        label="Dock utilization"
        value={formatPct(k.dockUtilization)}
        sub={`${k.occupiedDocks} of ${k.availableDocks} docks · dwell ${formatMinutes(k.avgDockDwellMinutes)}`}
        tone={k.dockUtilization > 0.9 ? "warn" : "neutral"}
        icon={<Warehouse className={iconCls} />}
        active={isActive("ops")}
        onClick={() => toggle("ops")}
        hint="Shows operations alerts"
      />
      <Kpi
        id="risk"
        label="Dollars at risk"
        value={formatMoney(k.dollarsAtRisk)}
        sub={`${plural(k.ordersWithExceptions, "order")} with exceptions`}
        tone={k.dollarsAtRisk > 0 ? "bad" : "ok"}
        icon={<CircleDollarSign className={iconCls} />}
        active={tab === "orders"}
        onClick={() => setTab("orders")}
        hint="Opens order-to-cash exceptions"
      />
      <Kpi
        id="clean"
        label="Clean-order rate"
        value={formatPct(k.cleanOrderRate)}
        sub={`${formatInt(k.orderCount - k.ordersWithExceptions)} of ${formatInt(k.orderCount)} orders`}
        tone={k.cleanOrderRate >= 0.9 ? "ok" : k.cleanOrderRate >= 0.75 ? "warn" : "bad"}
        icon={<PackageCheck className={iconCls} />}
        active={tab === "orders"}
        onClick={() => setTab("orders")}
        hint="Opens order-to-cash exceptions"
      />
      <Kpi
        id="expiring"
        label="Lots expiring ≤30d"
        value={formatInt(k.lotsExpiring30)}
        sub={k.expiredLots > 0 ? `plus ${plural(k.expiredLots, "expired lot")} on hand` : `${k.lotsExpiring90} within 90 days`}
        tone={k.expiredLots > 0 ? "bad" : k.lotsExpiring30 > 0 ? "warn" : "ok"}
        icon={<AlarmClock className={iconCls} />}
        active={isActive("expiry")}
        onClick={() => toggle("expiry")}
        hint="Shows expiry alerts"
      />
      <Kpi
        id="cold"
        label="Cold-chain alerts"
        value={formatInt(k.coldChainAlerts)}
        sub={k.coldChainAlerts ? "open now" : "all readings in range"}
        tone={k.coldChainAlerts > 0 ? "bad" : "ok"}
        icon={<Snowflake className={iconCls} />}
        active={isActive("cold")}
        onClick={() => toggle("cold")}
        hint="Shows cold-chain alerts"
      />
    </section>
  );
}
