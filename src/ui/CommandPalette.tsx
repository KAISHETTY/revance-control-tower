import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { AlarmClock, Box, FileText, MapPin, Package, Search, Thermometer, Truck, Warehouse } from "lucide-react";
import type { ReactNode } from "react";
import { EXCEPTION_LABELS } from "../engine/reconcile";
import { productName } from "../sim/products";
import type { ObjectRef } from "../sim/types";
import { useAlerts, useExceptions } from "../store/derived";
import { useWorld } from "../store/useWorld";

const itemCls =
  "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm text-fg data-[selected=true]:bg-accent/15 data-[selected=true]:text-fg";
const groupCls =
  "px-1 py-1 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-muted [&_[cmdk-group-heading]]:uppercase";

function Item({
  value,
  icon,
  children,
  onSelect,
  hint,
}: {
  value: string;
  icon: ReactNode;
  children: ReactNode;
  onSelect: () => void;
  hint?: string;
}) {
  return (
    <Command.Item value={value} onSelect={onSelect} className={itemCls}>
      <span className="text-muted" aria-hidden>
        {icon}
      </span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {hint ? <span className="shrink-0 text-xs text-muted">{hint}</span> : null}
    </Command.Item>
  );
}

/** Ctrl/Cmd+K: jump to any site, truck, dock, lot, order or alert by name. */
export default function CommandPalette() {
  const open = useWorld((s) => s.paletteOpen);
  const setOpen = useWorld((s) => s.setPaletteOpen);
  const world = useWorld((s) => s.world);
  const select = useWorld((s) => s.select);
  const openOrder = useWorld((s) => s.openOrder);
  const setView = useWorld((s) => s.setView);
  const alerts = useAlerts();
  const exceptions = useExceptions();

  const go = (ref: ObjectRef) => {
    setOpen(false);
    select(ref);
  };
  const exceptionOrders = new Map<string, string>();
  for (const e of exceptions) if (!exceptionOrders.has(e.orderId)) exceptionOrders.set(e.orderId, EXCEPTION_LABELS[e.type]);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]" />
        <Dialog.Content className="fixed top-[12dvh] left-1/2 z-50 w-[min(640px,calc(100vw-24px))] -translate-x-1/2 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl focus:outline-none">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search sites, trucks, docks, lots, orders and alerts</Dialog.Description>
          <Command label="Command palette" loop>
            <div className="flex items-center gap-2 border-b border-line px-3">
              <Search className="h-4 w-4 text-muted" aria-hidden />
              <Command.Input
                autoFocus
                placeholder="Jump to a site, truck, dock, lot, order or alert…"
                className="h-12 w-full bg-transparent text-sm text-fg outline-none placeholder:text-muted"
              />
            </div>
            <Command.List className="scrollbar-thin max-h-[56dvh] overflow-y-auto p-1">
              <Command.Empty className="px-3 py-8 text-center text-sm text-muted">Nothing matches that search.</Command.Empty>
              <Command.Group heading="Sites" className={groupCls}>
                <Item
                  value="network overview all sites"
                  icon={<MapPin className="h-4 w-4" />}
                  onSelect={() => (setOpen(false), setView("network"))}
                >
                  Network overview
                </Item>
                {world.sites.map((s) => (
                  <Item
                    key={s.id}
                    value={`site ${s.name} ${s.id}`}
                    icon={<MapPin className="h-4 w-4" />}
                    onSelect={() => go({ kind: "site", id: s.id })}
                  >
                    {s.name}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Alerts" className={groupCls}>
                {alerts.map((a) => (
                  <Item
                    key={a.id}
                    value={`alert ${a.title} ${a.ref.id}`}
                    icon={<AlarmClock className="h-4 w-4" />}
                    onSelect={() => go(a.ref)}
                    hint={a.severity}
                  >
                    {a.title}
                  </Item>
                ))}
              </Command.Group>
              <Command.Group heading="Trucks" className={groupCls}>
                {world.sites.flatMap((s) =>
                  s.trucks.map((t) => (
                    <Item
                      key={t.id}
                      value={`truck ${t.id} ${t.carrier} ${t.kind}`}
                      icon={<Truck className="h-4 w-4" />}
                      onSelect={() => go({ kind: "truck", id: t.id })}
                      hint={t.kind === "reefer" ? "Reefer" : "Dry"}
                    >
                      {t.id} · {t.carrier}
                    </Item>
                  )),
                )}
              </Command.Group>
              <Command.Group heading="Docks and cold rooms" className={groupCls}>
                {world.sites.flatMap((s) => [
                  ...s.docks.map((d) => (
                    <Item
                      key={d.id}
                      value={`dock ${s.shortName} ${d.label} ${d.id}`}
                      icon={<Warehouse className="h-4 w-4" />}
                      onSelect={() => go({ kind: "dock", id: d.id })}
                      hint={d.status}
                    >
                      {s.shortName} · {d.label}
                    </Item>
                  )),
                  ...s.coldRooms.map((r) => (
                    <Item
                      key={r.id}
                      value={`cold room ${s.shortName} ${r.label} ${r.id}`}
                      icon={<Thermometer className="h-4 w-4" />}
                      onSelect={() => go({ kind: "coldRoom", id: r.id })}
                    >
                      {s.shortName} · {r.label}
                    </Item>
                  )),
                ])}
              </Command.Group>
              <Command.Group heading="Lots" className={groupCls}>
                {world.sites.flatMap((s) =>
                  s.bays.flatMap((b) =>
                    b.lots.map((l) => (
                      <Item
                        key={l.lotId}
                        value={`lot ${l.lotId} ${productName(l.sku)} ${s.shortName}`}
                        icon={<Package className="h-4 w-4" />}
                        onSelect={() => go({ kind: "lot", id: l.lotId })}
                        hint={`${s.shortName} ${b.label}`}
                      >
                        {l.lotId} · {productName(l.sku)}
                      </Item>
                    )),
                  ),
                )}
              </Command.Group>
              <Command.Group heading="Orders" className={groupCls}>
                {world.orders.map((o) => (
                  <Item
                    key={o.orderId}
                    value={`order ${o.orderId} ${o.customer}`}
                    icon={exceptionOrders.has(o.orderId) ? <FileText className="h-4 w-4" /> : <Box className="h-4 w-4" />}
                    onSelect={() => (setOpen(false), openOrder(o.orderId))}
                    hint={exceptionOrders.get(o.orderId) ?? "Clean"}
                  >
                    {o.orderId} · {o.customer}
                  </Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
