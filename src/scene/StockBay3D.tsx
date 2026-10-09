import { Edges } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Color, Matrix4, Quaternion, Vector3, type InstancedMesh } from "three";
import { classifyExpiry, worstExpiry } from "../engine/expiry";
import { productBySku } from "../sim/products";
import type { ObjectRef, Site, StockBay, World } from "../sim/types";
import { resolveRef } from "../sim/lookup";
import { useWorld } from "../store/useWorld";
import { EXPIRY_COLORS } from "./colors";
import { ACCENT, UNIT_BOX, stdMat, useInteractive } from "./interactive";
import { BAY_D, BAY_W, siteLayout } from "./layout";

const LEVEL_H = 0.9;
const FLOOR_Y = 0.2;
const MAX_LEVELS = 3;
const COLS = 3;
const UNITS_PER_PALLET = { Injectable: 120, "Device Kit": 80, Skincare: 700 } as const;

interface PalletSpec {
  x: number;
  z: number;
  y: number;
  color: string;
}

/** Pallet stacks per bay: one column per lot, height by quantity, color by expiry. */
function palletsFor(site: Site, today: string): PalletSpec[] {
  const lay = siteLayout(site);
  const out: PalletSpec[] = [];
  for (const bay of site.bays) {
    const { pos } = lay.bays[bay.id];
    const heights = new Array(COLS).fill(0);
    bay.lots.forEach((lot, i) => {
      if (lot.qty <= 0) return;
      const col = i % COLS;
      const p = productBySku(lot.sku);
      const levels = Math.max(1, Math.min(MAX_LEVELS, Math.ceil(lot.qty / UNITS_PER_PALLET[p.category])));
      const color = EXPIRY_COLORS[classifyExpiry(lot.expiresOn, today)];
      for (let l = 0; l < levels && heights[col] < MAX_LEVELS + 1; l++) {
        out.push({ x: pos.x + (col - 1) * 0.9, z: pos.z, y: heights[col] * LEVEL_H, color });
        heights[col] += 1;
      }
    });
  }
  return out;
}

const m4 = new Matrix4();
const q = new Quaternion();
const v = new Vector3();
const s = new Vector3();
const c = new Color();

function stockKey(site: Site, today: string): string {
  return `${today}|${site.bays.map((b) => b.lots.map((l) => `${l.lotId}:${l.qty}`).join(",")).join("|")}`;
}

/** Instanced racks and pallets for one site: two draw calls for all its stock. */
function SiteStockInstances({ site, today }: { site: Site; today: string }) {
  const goods = useRef<InstancedMesh>(null);
  const bases = useRef<InstancedMesh>(null);
  const racks = useRef<InstancedMesh>(null);
  const key = stockKey(site, today);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- recompute only when stock changes, not on every tick clone
  const pallets = useMemo(() => palletsFor(site, today), [key]);
  const lay = siteLayout(site);
  const rackCount = site.bays.length * 5;

  useLayoutEffect(() => {
    const g = goods.current;
    const b = bases.current;
    if (!g || !b) return;
    pallets.forEach((p, i) => {
      v.set(p.x, FLOOR_Y + p.y + 0.12 + 0.31, p.z);
      s.set(0.76, 0.62, 1.0);
      g.setMatrixAt(i, m4.compose(v, q, s));
      g.setColorAt(i, c.set(p.color));
      v.set(p.x, FLOOR_Y + p.y + 0.06, p.z);
      s.set(0.82, 0.12, 1.08);
      b.setMatrixAt(i, m4.compose(v, q, s));
    });
    g.count = pallets.length;
    b.count = pallets.length;
    g.instanceMatrix.needsUpdate = true;
    b.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
    g.computeBoundingSphere();
    b.computeBoundingSphere();
  }, [pallets]);

  useLayoutEffect(() => {
    const r = racks.current;
    if (!r) return;
    let i = 0;
    for (const bay of site.bays) {
      const { pos } = lay.bays[bay.id];
      const h = MAX_LEVELS * LEVEL_H + 0.2;
      for (const sx of [-1, 1]) {
        v.set(pos.x + sx * (BAY_W / 2 + 0.05), FLOOR_Y + h / 2, pos.z);
        s.set(0.08, h, BAY_D);
        r.setMatrixAt(i++, m4.compose(v, q, s));
      }
      for (let l = 1; l <= 3; l++) {
        v.set(pos.x, FLOOR_Y + l * LEVEL_H - 0.02, pos.z + BAY_D / 2 - 0.03);
        s.set(BAY_W + 0.1, 0.07, 0.07);
        r.setMatrixAt(i++, m4.compose(v, q, s));
      }
    }
    r.count = i;
    r.instanceMatrix.needsUpdate = true;
    r.computeBoundingSphere();
  }, [site.bays, lay]);

  const noRaycast = () => null;
  return (
    <>
      <instancedMesh
        ref={goods}
        args={[UNIT_BOX, undefined, 200]}
        material={stdMat("#ffffff", { roughness: 0.85 })}
        castShadow
        receiveShadow
        raycast={noRaycast}
      />
      <instancedMesh ref={bases} args={[UNIT_BOX, undefined, 200]} material={stdMat("#8b6b4a", { roughness: 0.9 })} raycast={noRaycast} />
      <instancedMesh
        ref={racks}
        args={[UNIT_BOX, undefined, rackCount]}
        material={stdMat("#f97316", { roughness: 0.6, metalness: 0.3 })}
        castShadow
        raycast={noRaycast}
      />
    </>
  );
}

function bayOfSelection(world: World, sel: ObjectRef): string | undefined {
  if (sel.kind !== "lot") return undefined;
  const r = resolveRef(world, sel);
  return r?.kind === "lot" ? r.bay.id : undefined;
}

/** Invisible hit box over a bay, with an outline when hovered or selected. */
function BayHitBox({ bay, x, z, today }: { bay: StockBay; x: number; z: number; today: string }) {
  const { handlers, highlighted } = useInteractive(
    { kind: "bay", id: bay.id },
    (sel) => bayOfSelection(useWorld.getState().world, sel) === bay.id,
  );
  const h = MAX_LEVELS * LEVEL_H + 0.3;
  const quarantine = bay.zone === "quarantine";
  const status = worstExpiry(bay.lots, today);
  return (
    <group name={bay.id}>
      <mesh position={[x, h / 2, z]} scale={[BAY_W + 0.4, h, BAY_D + 0.4]} geometry={UNIT_BOX} {...handlers}>
        <meshBasicMaterial transparent opacity={highlighted ? 0.12 : 0} depthWrite={false} color={ACCENT} />
        {highlighted ? <Edges color={ACCENT} /> : null}
      </mesh>
      {/* Floor marking under the bay */}
      <mesh position={[x, 0.215, z]} scale={[BAY_W + 0.5, 0.01, BAY_D + 0.5]} geometry={UNIT_BOX} raycast={() => null}>
        <meshStandardMaterial
          color={quarantine ? "#f43f5e" : status === "expired" ? "#e5484d" : "#64748b"}
          transparent
          opacity={quarantine ? 0.55 : 0.25}
        />
      </mesh>
    </group>
  );
}

export function StockBays({ site, today }: { site: Site; today: string }) {
  const lay = siteLayout(site);
  return (
    <group>
      <SiteStockInstances site={site} today={today} />
      {site.bays.map((b) => (
        <BayHitBox key={b.id} bay={b} x={lay.bays[b.id].pos.x} z={lay.bays[b.id].pos.z} today={today} />
      ))}
    </group>
  );
}
