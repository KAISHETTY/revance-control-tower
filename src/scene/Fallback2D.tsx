import type { KeyboardEvent, ReactNode } from "react";
import { worstExpiry } from "../engine/expiry";
import type { Alert } from "../engine/alerts";
import { physicalRef } from "../sim/lookup";
import type { ObjectRef, Site, World } from "../sim/types";
import { useAlerts } from "../store/derived";
import { useWorld } from "../store/useWorld";
import { COLD_COLORS, DOCK_COLORS, EXPIRY_COLORS, FORKLIFT_COLOR, HEALTH_COLORS, SCENE_DARK, SCENE_LIGHT } from "./colors";
import { siteHealth } from "./health";
import { BAY_D, BAY_W, forkliftPose, siteLayout, truckPose, TRUCK_LENGTH, type Vec2 } from "./layout";

const DEG = 180 / Math.PI;

interface ClickableProps {
  objRef: ObjectRef;
  label: string;
  children: ReactNode;
}

/** An SVG group that behaves like a button for mouse, touch and keyboard. */
function Clickable({ objRef, label, children }: ClickableProps) {
  const select = useWorld((s) => s.select);
  const selected = useWorld((s) => s.selection?.kind === objRef.kind && s.selection.id === objRef.id);
  const onKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      select(objRef);
    }
  };
  return (
    <g
      role="button"
      tabIndex={0}
      aria-label={label}
      aria-pressed={selected}
      data-testid={`obj-${objRef.kind}-${objRef.id}`}
      onClick={(e) => {
        e.stopPropagation();
        select(objRef);
      }}
      onKeyDown={onKey}
      className="cursor-pointer outline-none [&:focus-visible>*:first-child]:stroke-[var(--accent)]"
      style={{ filter: selected ? "drop-shadow(0 0 0.6px var(--accent))" : undefined }}
    >
      {children}
    </g>
  );
}

function Pulse({ at, color, r = 1.6 }: { at: Vec2; color: string; r?: number }) {
  return (
    <g pointerEvents="none">
      <circle cx={at.x} cy={at.z} r={r} fill="none" stroke={color} strokeWidth={0.35} className="pulse-ring" />
      <circle cx={at.x} cy={at.z} r={r * 0.35} fill={color} />
    </g>
  );
}

function alertIndex(world: World, alerts: Alert[]): Map<string, Alert> {
  const m = new Map<string, Alert>();
  for (const a of alerts) {
    const p = physicalRef(world, a.ref);
    if (!p || p.kind === "site") continue;
    if (!m.has(p.id)) m.set(p.id, a);
  }
  return m;
}

const SEV_COLOR = { high: "#f43f5e", medium: "#fbbf24", low: "#38bdf8" } as const;

function TruckGlyph({ length, reefer, color, stroke }: { length: number; reefer: boolean; color: string; stroke: string }) {
  // Drawn facing +y (south) in local space, matching rot = 0 facing +z.
  const w = 2.2;
  return (
    <>
      <rect
        x={-w / 2}
        y={-length / 2}
        width={w}
        height={length * 0.72}
        rx={0.25}
        fill={reefer ? "#f1f5f9" : "#cbd5e1"}
        stroke={stroke}
        strokeWidth={0.2}
      />
      <rect x={-w / 2} y={length * 0.25} width={w} height={length * 0.25} rx={0.3} fill={color} stroke={stroke} strokeWidth={0.2} />
      {reefer ? <rect x={-w / 2 + 0.3} y={length * 0.12} width={w - 0.6} height={0.7} fill="#0ea5e9" /> : null}
    </>
  );
}

function SiteDetail({ site, world, alerts, light }: { site: Site; world: World; alerts: Map<string, Alert>; light: boolean }) {
  const lay = siteLayout(site);
  const pal = light ? SCENE_LIGHT : SCENE_DARK;
  const o = lay.origin;
  const text = light ? "#0f172a" : "#e2e8f0";
  const sub = light ? "#475569" : "#94a3b8";
  return (
    <g>
      {/* Building floor and walls */}
      <rect
        x={o.x - lay.width / 2}
        y={o.z - lay.depth / 2}
        width={lay.width}
        height={lay.depth}
        fill={pal.floor}
        stroke={pal.wall}
        strokeWidth={0.5}
        rx={0.4}
      />
      <text x={o.x - lay.width / 2 + 0.6} y={o.z - lay.depth / 2 - 0.8} fontSize={1.6} fill={text} fontWeight={600}>
        {site.name}
      </text>

      {/* Cold rooms */}
      {site.coldRooms.map((r) => {
        const c = lay.coldRooms[r.id];
        const a = alerts.get(r.id);
        return (
          <Clickable key={r.id} objRef={{ kind: "coldRoom", id: r.id }} label={`${r.label}, ${r.currentC.toFixed(1)} degrees, ${r.status}`}>
            <rect
              x={c.center.x - c.w / 2}
              y={c.center.z - c.d / 2}
              width={c.w}
              height={c.d}
              fill={COLD_COLORS.ok}
              fillOpacity={0.14}
              stroke={COLD_COLORS[r.status]}
              strokeWidth={0.35}
              rx={0.3}
            />
            <text
              x={c.center.x}
              y={c.center.z + c.d / 2 - 2}
              fontSize={0.9}
              textAnchor="middle"
              fill={COLD_COLORS[r.status]}
              fontWeight={600}
            >
              {r.label}
            </text>
            <text
              x={c.center.x}
              y={c.center.z + c.d / 2 - 0.7}
              fontSize={1.2}
              textAnchor="middle"
              fill={COLD_COLORS[r.status]}
              fontWeight={700}
            >
              {r.currentC.toFixed(1)}°C
            </text>
            {a ? <Pulse at={{ x: c.center.x + c.w / 2 - 0.9, z: c.center.z - c.d / 2 + 0.9 }} color={SEV_COLOR[a.severity]} /> : null}
          </Clickable>
        );
      })}

      {/* Bays */}
      {site.bays.map((b) => {
        const p = lay.bays[b.id].pos;
        const status = worstExpiry(b.lots, world.today);
        const fill = b.lots.length ? EXPIRY_COLORS[status] : pal.island;
        const a = alerts.get(b.id);
        return (
          <Clickable key={b.id} objRef={{ kind: "bay", id: b.id }} label={`Bay ${b.label}, ${b.lots.length} lots, ${status}`}>
            <rect
              x={p.x - BAY_W / 2}
              y={p.z - BAY_D / 2}
              width={BAY_W}
              height={BAY_D}
              fill={fill}
              stroke={b.zone === "quarantine" ? "#f43f5e" : pal.islandEdge}
              strokeWidth={b.zone === "quarantine" ? 0.3 : 0.15}
              strokeDasharray={b.zone === "quarantine" ? "0.5 0.3" : undefined}
              rx={0.15}
            />
            <text x={p.x} y={p.z - BAY_D / 2 - 0.35} fontSize={0.75} textAnchor="middle" fill={sub}>
              {b.label}
            </text>
            {a ? <Pulse at={{ x: p.x + BAY_W / 2, z: p.z - BAY_D / 2 }} color={SEV_COLOR[a.severity]} r={1.1} /> : null}
          </Clickable>
        );
      })}

      {/* Charger */}
      <rect
        x={lay.charger.x - 0.8}
        y={lay.charger.z - 0.8}
        width={1.6}
        height={1.6}
        fill="none"
        stroke={sub}
        strokeWidth={0.15}
        strokeDasharray="0.3 0.2"
      />

      {/* Docks */}
      {site.docks.map((d) => {
        const dl = lay.docks[d.id];
        const a = alerts.get(d.id);
        return (
          <Clickable key={d.id} objRef={{ kind: "dock", id: d.id }} label={`${d.label}, ${d.type}, ${d.status}`}>
            <rect x={dl.pad.x - 1.6} y={dl.pad.z - 0.9} width={3.2} height={1.8} fill={DOCK_COLORS[d.status]} fillOpacity={0.85} rx={0.2} />
            <text x={dl.pad.x} y={dl.door.z - 0.6} fontSize={0.8} textAnchor="middle" fill={sub}>
              {d.label.replace("Dock ", "D")} {d.type === "inbound" ? "IN" : "OUT"}
            </text>
            {a ? <Pulse at={{ x: dl.pad.x + 1.6, z: dl.pad.z }} color={SEV_COLOR[a.severity]} r={1.1} /> : null}
          </Clickable>
        );
      })}

      {/* Yard label */}
      <text x={lay.yard[0].x - 2} y={lay.yard[0].z + 6} fontSize={0.9} fill={sub}>
        Yard
      </text>

      {/* Forklifts */}
      {site.forklifts.map((f) => {
        const p = forkliftPose(site, f);
        const a = alerts.get(f.id);
        return (
          <Clickable
            key={f.id}
            objRef={{ kind: "forklift", id: f.id }}
            label={`Forklift ${f.id}, ${f.status}, battery ${Math.round(f.battery)} percent`}
          >
            <circle cx={p.x} cy={p.z} r={0.75} fill={FORKLIFT_COLOR} stroke="#713f12" strokeWidth={0.15} />
            {a ? <Pulse at={{ x: p.x, z: p.z - 1 }} color={SEV_COLOR[a.severity]} r={0.9} /> : null}
          </Clickable>
        );
      })}
    </g>
  );
}

function TruckMark({
  world,
  site,
  truckId,
  alerts,
  scale,
}: {
  world: World;
  site: Site;
  truckId: string;
  alerts: Map<string, Alert>;
  scale: number;
}) {
  const t = site.trucks.find((x) => x.id === truckId)!;
  const p = truckPose(world, t, site);
  const a = alerts.get(t.id);
  const color = t.kind === "reefer" ? "#0284c7" : "#475569";
  return (
    <Clickable objRef={{ kind: "truck", id: t.id }} label={`Truck ${t.id}, ${t.kind}, ${t.status}`}>
      <g transform={`translate(${p.x} ${p.z}) rotate(${-p.rot * DEG}) scale(${scale})`}>
        <TruckGlyph length={TRUCK_LENGTH} reefer={t.kind === "reefer"} color={color} stroke="#0f172a" />
      </g>
      {a ? <Pulse at={{ x: p.x, z: p.z - 3 * scale }} color={SEV_COLOR[a.severity]} r={1.4 * scale} /> : null}
    </Clickable>
  );
}

/**
 * Schematic top-down view with the same objects, colors and click behavior as
 * the 3D scene. Used when WebGL is missing or slow, or by choice.
 */
export default function Fallback2D() {
  const world = useWorld((s) => s.world);
  const view = useWorld((s) => s.view);
  const theme = useWorld((s) => s.theme);
  const alertsList = useAlerts();
  const select = useWorld((s) => s.select);
  const light = theme === "light";
  const pal = light ? SCENE_LIGHT : SCENE_DARK;
  const alerts = alertIndex(world, alertsList);
  const text = light ? "#0f172a" : "#e2e8f0";

  let viewBox: string;
  if (view === "network") {
    viewBox = "-135 -75 255 160";
  } else {
    const lay = siteLayout(world.sites.find((s) => s.id === view)!);
    const x0 = lay.origin.x - lay.width / 2 - 4;
    const z0 = lay.origin.z - lay.depth / 2 - 4;
    viewBox = `${x0} ${z0} ${lay.width + 8} ${lay.depth + 32}`;
  }

  const roads: [Vec2, Vec2][] = [];
  const done = new Set<string>();
  for (const s of world.sites) {
    const lay = siteLayout(s);
    roads.push([lay.extFar, lay.gates.EXT]);
    for (const o of world.sites) {
      const key = [s.id, o.id].sort().join();
      if (o.id === s.id || done.has(key)) continue;
      done.add(key);
      roads.push([lay.gates[o.id], siteLayout(o).gates[s.id]]);
    }
  }

  return (
    <div className="absolute inset-0" style={{ background: pal.background }} data-testid="fallback-2d">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="group"
        aria-label={view === "network" ? "Network map" : `Site map`}
        onClick={() => select(null)}
      >
        {roads.map(([a, b], i) => (
          <g key={i}>
            <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke={pal.road} strokeWidth={3.2} strokeLinecap="round" />
            <line x1={a.x} y1={a.z} x2={b.x} y2={b.z} stroke={pal.roadLine} strokeWidth={0.25} strokeDasharray="2 2" />
          </g>
        ))}
        {world.sites.map((s) => {
          const lay = siteLayout(s);
          const health = siteHealth(alertsList, s.id);
          return (
            <g key={s.id}>
              <Clickable objRef={{ kind: "site", id: s.id }} label={`${s.name}, health ${health}`}>
                <circle
                  cx={lay.origin.x}
                  cy={lay.origin.z}
                  r={lay.radius}
                  fill={pal.island}
                  stroke={HEALTH_COLORS[health]}
                  strokeWidth={view === "network" ? 1 : 0.4}
                  strokeOpacity={0.9}
                />
                {view === "network" ? (
                  <>
                    <rect
                      x={lay.origin.x - lay.width / 2}
                      y={lay.origin.z - lay.depth / 2}
                      width={lay.width}
                      height={lay.depth}
                      fill={pal.floor}
                      stroke={pal.wall}
                      strokeWidth={0.6}
                      rx={0.6}
                    />
                    <text x={lay.origin.x} y={lay.origin.z - lay.radius - 3} fontSize={5} textAnchor="middle" fill={text} fontWeight={600}>
                      {s.shortName}
                    </text>
                  </>
                ) : null}
              </Clickable>
              {view === s.id ? <SiteDetail site={s} world={world} alerts={alerts} light={light} /> : null}
            </g>
          );
        })}
        {world.sites.flatMap((s) =>
          s.trucks.map((t) => (
            <TruckMark key={t.id} world={world} site={s} truckId={t.id} alerts={alerts} scale={view === "network" ? 1.6 : 1} />
          )),
        )}
      </svg>
    </div>
  );
}
