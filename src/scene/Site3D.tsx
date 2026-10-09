import { Edges } from "@react-three/drei";
import { memo } from "react";
import type { ColdRoom, Site, World } from "../sim/types";
import { COLD_COLORS, type ScenePalette } from "./colors";
import { Dock3D } from "./Dock3D";
import { Forklift3D } from "./Forklift3D";
import { Box, Glow } from "./instances";
import { ACCENT, UNIT_BOX, useInteractive } from "./interactive";
import { forkliftPose, siteLayout, WALL_HEIGHT, type SiteLayout } from "./layout";
import { StockBays } from "./StockBay3D";

const COLD_H = 3.0;

const ColdRoom3D = memo(
  function ColdRoom3D({ room, lay }: { room: ColdRoom; lay: SiteLayout }) {
    const { handlers, highlighted } = useInteractive({ kind: "coldRoom", id: room.id });
    const c = lay.coldRooms[room.id];
    const edge = highlighted ? ACCENT : COLD_COLORS[room.status];
    const unitX = c.center.x + c.w / 2 - 1.3;
    const unitZ = c.center.z - c.d / 2 + 1;
    return (
      <group name={room.id}>
        <mesh position={[c.center.x, 0.2 + COLD_H / 2, c.center.z]} scale={[c.w, COLD_H, c.d]} geometry={UNIT_BOX} {...handlers}>
          <meshStandardMaterial color="#7dd3fc" transparent opacity={highlighted ? 0.26 : 0.16} depthWrite={false} roughness={0.2} />
          <Edges color={edge} />
        </mesh>
        {/* Refrigeration unit and status lamp on top; tinted floor inside */}
        <Box position={[unitX, 0.2 + COLD_H + 0.35, unitZ]} scale={[1.8, 0.7, 1.2]} color="#cbd5e1" />
        <Glow position={[unitX, 0.2 + COLD_H + 0.72, unitZ]} scale={[0.9, 0.04, 0.9]} color={COLD_COLORS[room.status]} />
        <Box position={[c.center.x, 0.21, c.center.z]} scale={[c.w - 0.2, 0.02, c.d - 0.2]} color="#1e4f6e" />
      </group>
    );
  },
  (a, b) => a.lay === b.lay && a.room.status === b.room.status && a.room.id === b.room.id,
);

const Building = memo(function Building({ lay, palette }: { lay: SiteLayout; palette: ScenePalette }) {
  const { origin: o, width: w, depth: d } = lay;
  const t = 0.3;
  const low = 1.1;
  return (
    <group>
      <Box position={[o.x, 0.1, o.z]} scale={[w, 0.2, d]} color={palette.floor} />
      {/* Full-height back and left walls; low front and right walls as a cutaway */}
      <Box position={[o.x, WALL_HEIGHT / 2, o.z - d / 2]} scale={[w, WALL_HEIGHT, t]} color={palette.wall} />
      <Box position={[o.x - w / 2, WALL_HEIGHT / 2, o.z]} scale={[t, WALL_HEIGHT, d]} color={palette.wall} />
      <Box position={[o.x + w / 2, low / 2, o.z]} scale={[t, low, d]} color={palette.wall} />
      <Box position={[o.x, low / 2, o.z + d / 2]} scale={[w, low, t]} color={palette.wall} />
      <Box position={[o.x, WALL_HEIGHT + 0.08, o.z - d / 2]} scale={[w + 0.2, 0.16, t + 0.2]} color="#334155" />
      <Box position={[o.x - w / 2, WALL_HEIGHT + 0.08, o.z]} scale={[t + 0.2, 0.16, d + 0.2]} color="#334155" />
      {/* Forklift lane along the docks */}
      <Box position={[o.x, 0.21, o.z + d / 2 - 2]} scale={[w - 2, 0.02, 0.12]} color="#facc15" />
      <Box position={[o.x, 0.21, o.z + d / 2 - 3.4]} scale={[w - 2, 0.02, 0.12]} color="#facc15" />
      {/* Apron and yard */}
      <Box position={[o.x, 0.03, o.z + d / 2 + 12]} scale={[w + 14, 0.06, 24]} color={palette.road} />
      {lay.yard.map((p, i) => (
        <Box key={i} position={[p.x + 2.2, 0.07, p.z]} scale={[0.12, 0.02, 9]} color={palette.roadLine} />
      ))}
      {/* Charger */}
      <Box position={[lay.charger.x - 0.4, 0.8, lay.charger.z]} scale={[0.4, 1.2, 0.8]} color="#334155" />
      <Glow position={[lay.charger.x - 0.18, 1.2, lay.charger.z]} scale={[0.05, 0.2, 0.3]} color="#22c55e" />
    </group>
  );
});

export function Site3D({
  site,
  world,
  palette,
  reducedMotion,
}: {
  site: Site;
  world: World;
  palette: ScenePalette;
  reducedMotion: boolean;
}) {
  const lay = siteLayout(site);
  return (
    <group name={site.id}>
      <Building lay={lay} palette={palette} />
      {site.docks.map((d) => (
        <Dock3D key={d.id} dock={d} layout={lay.docks[d.id]} />
      ))}
      {site.coldRooms.map((r) => (
        <ColdRoom3D key={r.id} room={r} lay={lay} />
      ))}
      <StockBays site={site} today={world.today} />
      {site.forklifts.map((f) => (
        <Forklift3D key={f.id} forklift={f} pose={forkliftPose(site, f)} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}
