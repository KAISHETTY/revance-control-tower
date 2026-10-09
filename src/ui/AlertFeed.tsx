import { AnimatePresence, m } from "framer-motion";
import { AlarmClock, BellOff, ChevronRight, Snowflake, Truck, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import type { Alert, AlertCategory } from "../engine/alerts";
import { cn } from "../lib/cn";
import { siteName } from "../sim/lookup";
import { useAlerts } from "../store/derived";
import { useWorld, type AlertFilter } from "../store/useWorld";
import { SEVERITY_LABEL } from "./labels";

const FILTERS: { value: AlertFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "cold", label: "Temperature" },
  { value: "expiry", label: "Expiry" },
  { value: "ops", label: "Operations" },
  { value: "shipping", label: "Shipping" },
];

const ICONS: Record<AlertCategory, ReactNode> = {
  cold: <Snowflake className="h-4 w-4" />,
  expiry: <AlarmClock className="h-4 w-4" />,
  ops: <Wrench className="h-4 w-4" />,
  shipping: <Truck className="h-4 w-4" />,
};

const SEV_BAR = { high: "bg-bad", medium: "bg-warn", low: "bg-info" } as const;
const SEV_TEXT = { high: "text-bad", medium: "text-warn", low: "text-info" } as const;

function AlertRow({ alert, selected }: { alert: Alert; selected: boolean }) {
  const select = useWorld((s) => s.select);
  const world = useWorld((s) => s.world);
  return (
    <button
      type="button"
      onClick={() => select(alert.ref)}
      data-testid="alert-row"
      data-alert-id={alert.id}
      data-ref={`${alert.ref.kind}:${alert.ref.id}`}
      className={cn(
        "group relative flex w-full items-start gap-3 overflow-hidden rounded-lg border bg-panel px-3 py-2.5 pl-4 text-left transition-colors hover:bg-panel-2",
        selected ? "border-accent" : "border-line",
      )}
    >
      <span className={cn("absolute inset-y-0 left-0 w-1", SEV_BAR[alert.severity])} aria-hidden />
      <span className={cn("mt-0.5", SEV_TEXT[alert.severity])} aria-hidden>
        {ICONS[alert.category]}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm leading-snug font-medium">{alert.title}</span>
        <span className="mt-0.5 block text-xs leading-snug text-muted">
          <span className={cn("font-semibold", SEV_TEXT[alert.severity])}>{SEVERITY_LABEL[alert.severity]}</span>
          {" · "}
          {siteName(world, alert.siteId)}
          {" · "}
          {alert.nextStep}
        </span>
      </span>
      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted opacity-0 transition-opacity group-hover:opacity-100" aria-hidden />
    </button>
  );
}

export function AlertFeed() {
  const alerts = useAlerts();
  const filter = useWorld((s) => s.alertFilter);
  const setFilter = useWorld((s) => s.setAlertFilter);
  const selection = useWorld((s) => s.selection);
  const shown = filter === "all" ? alerts : alerts.filter((a) => a.category === filter);
  const counts = (f: AlertFilter) => (f === "all" ? alerts.length : alerts.filter((a) => a.category === f).length);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div role="radiogroup" aria-label="Filter alerts" className="no-scrollbar flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="radio"
            aria-checked={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "h-7 shrink-0 rounded-full px-2.5 text-xs font-medium ring-1 transition-colors ring-inset",
              filter === f.value ? "bg-accent/15 text-accent ring-accent/40" : "text-muted ring-line hover:text-fg",
            )}
          >
            {f.label} <span className="tabular opacity-70">{counts(f.value)}</span>
          </button>
        ))}
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 pb-3" aria-live="polite" aria-label="Alerts">
        {shown.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
            <BellOff className="h-6 w-6" aria-hidden />
            <p>Nothing needs attention in this category right now.</p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {shown.map((a) => (
              <m.div
                key={a.id}
                layout="position"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                <AlertRow alert={a} selected={selection?.id === a.ref.id} />
              </m.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
