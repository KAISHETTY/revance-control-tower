import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { formatMoney } from "../lib/format";
import { getAlerts, getExceptions } from "../store/derived";
import { useWorld } from "../store/useWorld";
import { COLD_COLORS, HEALTH_COLORS } from "./colors";
import { siteHealth } from "./health";
import { siteLayout } from "./layout";

/*
 * DOM labels positioned over the canvas. React renders the buttons outside the
 * <Canvas>; a projector inside it moves them every frame. This keeps labels
 * real, focusable buttons without mounting extra React roots inside the scene.
 */

interface Anchor {
  el: HTMLElement;
  pos: [number, number, number];
  /** Cached element width, refreshed now and then (reading layout every frame would stall). */
  w: number;
}

let frame = 0;

const anchors = new Map<string, Anchor>();
const v = new Vector3();

function register(id: string, pos: [number, number, number]) {
  return (el: HTMLElement | null) => {
    if (el) anchors.set(id, { el, pos, w: anchors.get(id)?.w ?? 0 });
    else anchors.delete(id);
  };
}

/** Lives inside the Canvas: projects every anchor to screen space. */
export function LabelProjector() {
  const { camera, size } = useThree();
  useFrame(() => {
    frame = (frame + 1) % 60;
    if (frame === 0) for (const a of anchors.values()) a.w = a.el.offsetWidth;
    for (const a of anchors.values()) if (!a.w) a.w = a.el.offsetWidth;
    for (const { el, pos, w } of anchors.values()) {
      v.set(pos[0], pos[1], pos[2]).project(camera);
      const hidden = v.z > 1 || v.x < -1.2 || v.x > 1.2 || v.y < -1.2 || v.y > 1.2;
      el.style.visibility = hidden ? "hidden" : "visible";
      if (hidden) continue;
      // Keep the whole label inside the map.
      const half = w / 2 + 6;
      const x = Math.min(size.width - half, Math.max(half, ((v.x + 1) / 2) * size.width));
      const y = ((1 - v.y) / 2) * size.height;
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  });
  return null;
}

/** Lives outside the Canvas: the label buttons themselves. */
export function ScreenLabels() {
  const world = useWorld((s) => s.world);
  const view = useWorld((s) => s.view);
  const select = useWorld((s) => s.select);
  const alerts = getAlerts(world);
  const exceptions = getExceptions(world);
  const focused = view === "network" ? undefined : world.sites.find((s) => s.id === view);

  return (
    <div className="@container pointer-events-none absolute inset-0 overflow-hidden" role="group" aria-label="Map labels">
      {world.sites.map((s) => {
        if (view === s.id) return null;
        const lay = siteLayout(s);
        const health = siteHealth(alerts, s.id);
        const count = alerts.filter((a) => a.siteId === s.id).length;
        const risk = exceptions.filter((e) => e.siteId === s.id).reduce((a, e) => a + e.dollarImpact, 0);
        return (
          <button
            key={s.id}
            ref={register(`site-${s.id}`, [lay.origin.x, 10, lay.origin.z - lay.depth / 2 - 2])}
            type="button"
            onClick={() => select({ kind: "site", id: s.id })}
            style={{ visibility: "hidden" }}
            className="pointer-events-auto absolute top-0 left-0 flex items-center gap-2 rounded-full border border-line bg-panel/90 py-1 pr-3 pl-2 text-xs whitespace-nowrap text-fg shadow-lg backdrop-blur hover:border-accent"
            data-testid={`site-label-${s.id}`}
            aria-label={`${s.name}: ${count} alerts, ${formatMoney(risk)} at risk. Open site.`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: HEALTH_COLORS[health] }} aria-hidden />
            <span className="font-semibold">{s.shortName}</span>
            <span className="hidden text-muted @[560px]:inline">
              {count} alerts · {formatMoney(risk)}
            </span>
          </button>
        );
      })}
      {focused
        ? focused.coldRooms.map((r) => {
            const c = siteLayout(focused).coldRooms[r.id];
            return (
              <button
                key={r.id}
                ref={register(`room-${r.id}`, [c.center.x, 4.6, c.center.z])}
                type="button"
                onClick={() => select({ kind: "coldRoom", id: r.id })}
                style={{ visibility: "hidden", borderColor: COLD_COLORS[r.status], color: COLD_COLORS[r.status] }}
                className="pointer-events-auto absolute top-0 left-0 rounded-md border bg-panel/90 px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap shadow backdrop-blur"
              >
                {r.label} · {r.currentC.toFixed(1)}°C
              </button>
            );
          })
        : null}
    </div>
  );
}
