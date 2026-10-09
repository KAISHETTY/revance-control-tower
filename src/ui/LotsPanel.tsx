import { PackageSearch } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "../components/ui/badge";
import { EXPIRY_ORDER, expiryBuckets, type ExpiryStatus } from "../engine/expiry";
import { cn } from "../lib/cn";
import { formatShortDate } from "../lib/dates";
import { formatInt, formatMoney } from "../lib/format";
import { siteName } from "../sim/lookup";
import type { SiteId } from "../sim/types";
import { useLots } from "../store/derived";
import { useWorld } from "../store/useWorld";
import { EXPIRY_LABEL, EXPIRY_TONE } from "./labels";

const selectCls = "h-8 rounded-md border border-line bg-panel px-2 text-xs text-fg";

function daysText(days: number): string {
  if (days < 0) return `${-days}d ago`;
  if (days === 0) return "today";
  return `${days}d`;
}

export function LotsPanel() {
  const lots = useLots();
  const world = useWorld((s) => s.world);
  const select = useWorld((s) => s.select);
  const selection = useWorld((s) => s.selection);
  const [site, setSite] = useState<SiteId | "all">("all");
  const [status, setStatus] = useState<ExpiryStatus | "all">("all");

  const bySite = useMemo(() => (site === "all" ? lots : lots.filter((l) => l.siteId === site)), [lots, site]);
  const buckets = useMemo(() => expiryBuckets(bySite), [bySite]);
  const rows = status === "all" ? bySite : bySite.filter((l) => l.status === status);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-line px-3 py-2.5">
        <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Filter by expiry status">
          {EXPIRY_ORDER.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={status === s}
              onClick={() => setStatus(status === s ? "all" : s)}
              data-testid={`lots-bucket-${s}`}
              className={cn(
                "rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-panel-2",
                status === s ? "border-accent" : "border-line",
              )}
            >
              <span className="block text-[10px] font-semibold tracking-wide text-muted uppercase">{EXPIRY_LABEL[s]}</span>
              <span className="tabular block text-base leading-tight font-semibold">{buckets[s].lots}</span>
              <span className="tabular block text-[10px] text-muted">{formatMoney(buckets[s].value)}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <select
            aria-label="Site"
            value={site}
            onChange={(e) => setSite(e.target.value as SiteId | "all")}
            className={selectCls}
            data-testid="lots-site"
          >
            <option value="all">All sites</option>
            {world.sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.shortName}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted">{rows.length} lots, soonest expiry first</span>
        </div>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted">
            <PackageSearch className="h-6 w-6" aria-hidden />
            <p>No lots in this bucket{site !== "all" ? ` at ${siteName(world, site)}` : ""}.</p>
          </div>
        ) : (
          <ul className="divide-y divide-line/70" aria-label="Lots">
            {rows.map((l) => (
              <li key={l.lotId}>
                <button
                  type="button"
                  onClick={() => select({ kind: "lot", id: l.lotId })}
                  data-testid="lot-row"
                  data-lot={l.lotId}
                  data-status={l.status}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-panel-2",
                    selection?.id === l.lotId && "bg-accent/10",
                  )}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{l.productName}</span>
                    <span className="block truncate text-xs text-muted">
                      <span className="font-mono">{l.lotId}</span> · {siteName(world, l.siteId)} bay {l.bayLabel} · {formatInt(l.qty)} units
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <Badge tone={EXPIRY_TONE[l.status]}>{l.status === "ok" ? "OK" : EXPIRY_LABEL[l.status]}</Badge>
                    <span className="tabular mt-0.5 block text-[11px] text-muted">
                      {formatShortDate(l.expiresOn)} · {daysText(l.daysLeft)}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
