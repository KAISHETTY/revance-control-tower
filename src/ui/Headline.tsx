import { formatMoney, plural } from "../lib/format";
import { siteName } from "../sim/lookup";
import { useFocusSite, useKpis } from "../store/derived";
import { useWorld } from "../store/useWorld";

/** Computed one-sentence overview. Every number comes from the engine. */
export function Headline() {
  const site = useFocusSite();
  const k = useKpis(site);
  const world = useWorld((s) => s.world);
  const scope = site ? `At ${siteName(world, site)}` : `Across ${world.sites.length} sites`;
  const expiring = k.lotsExpiring90 + k.expiredLots;
  return (
    <p className="px-3 pt-2 text-[13px] leading-snug text-muted sm:px-4 sm:text-sm" data-testid="headline">
      <span className="font-medium text-fg">{scope}:</span> {plural(k.coldChainAlerts, "cold-chain alert")}, {plural(expiring, "lot")}{" "}
      expired or expiring within 90 days, and{" "}
      <span className="text-fg">
        {k.ordersWithExceptions} of {k.orderCount} orders
      </span>{" "}
      with billing or shipping problems, about <span className="font-semibold text-bad">{formatMoney(k.dollarsAtRisk)}</span> at risk.
    </p>
  );
}
