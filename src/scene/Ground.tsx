import { Grid } from "@react-three/drei";
import { useMemo } from "react";
import type { Alert } from "../engine/alerts";
import type { World } from "../sim/types";
import { HEALTH_COLORS, type ScenePalette } from "./colors";
import { siteHealth } from "./health";
import { Box } from "./instances";
import { useInteractive } from "./interactive";
import { siteLayout, type Vec2 } from "./layout";

function Road({ a, b, palette }: { a: Vec2; b: Vec2; palette: ScenePalette }) {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  const rot = Math.atan2(dx, dz);
  const dashes = Math.floor(len / 6);
  return (
    <group position={[(a.x + b.x) / 2, 0, (a.z + b.z) / 2]} rotation={[0, rot, 0]}>
      <Box scale={[4.4, 0.1, len]} position={[0, -0.04, 0]} color={palette.road} />
      {Array.from({ length: dashes }, (_, i) => (
        <Box key={i} scale={[0.18, 0.02, 2.4]} position={[0, 0.03, -len / 2 + 3 + i * 6]} color={palette.roadLine} />
      ))}
    </group>
  );
}

function Island({
  siteId,
  world,
  alerts,
  palette,
  showRing,
}: {
  siteId: World["sites"][number]["id"];
  world: World;
  alerts: Alert[];
  palette: ScenePalette;
  showRing: boolean;
}) {
  const site = world.sites.find((s) => s.id === siteId)!;
  const lay = siteLayout(site);
  const health = siteHealth(alerts, siteId);
  const { handlers } = useInteractive({ kind: "site", id: siteId });
  const ring = HEALTH_COLORS[health];
  return (
    <group position={[lay.origin.x, 0, lay.origin.z]}>
      <mesh position={[0, -0.16, 0]} receiveShadow {...handlers} name={`island-${siteId}`}>
        <cylinderGeometry args={[lay.radius, lay.radius + 0.6, 0.32, 64]} />
        <meshStandardMaterial color={palette.island} roughness={0.95} />
      </mesh>
      {showRing ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} raycast={() => null}>
          <ringGeometry args={[lay.radius - 0.9, lay.radius - 0.2, 96]} />
          <meshBasicMaterial color={ring} toneMapped={false} transparent opacity={0.9} />
        </mesh>
      ) : null}
    </group>
  );
}

export function Ground({ world, alerts, palette, low }: { world: World; alerts: Alert[]; palette: ScenePalette; low: boolean }) {
  const roads = useMemo(() => {
    const out: [Vec2, Vec2][] = [];
    const seen = new Set<string>();
    for (const s of world.sites) {
      const lay = siteLayout(s);
      out.push([lay.gates.EXT, lay.extFar]);
      for (const o of world.sites) {
        const key = [s.id, o.id].sort().join();
        if (o.id === s.id || seen.has(key)) continue;
        seen.add(key);
        out.push([lay.gates[o.id], siteLayout(o).gates[s.id]]);
      }
    }
    return out;
  }, [world.sites]);

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.34, 0]} receiveShadow raycast={() => null}>
        <planeGeometry args={[1400, 1400]} />
        <meshStandardMaterial color={palette.ground} roughness={1} />
      </mesh>
      {!low ? (
        <Grid
          position={[0, -0.3, 0]}
          args={[800, 800]}
          cellSize={5}
          cellThickness={0.5}
          cellColor={palette.islandEdge}
          sectionSize={25}
          sectionThickness={0.9}
          sectionColor={palette.islandEdge}
          fadeDistance={420}
          fadeStrength={1.6}
          infiniteGrid
        />
      ) : null}
      {roads.map(([a, b], i) => (
        <Road key={i} a={a} b={b} palette={palette} />
      ))}
      {world.sites.map((s) => (
        <Island key={s.id} siteId={s.id} world={world} alerts={alerts} palette={palette} showRing />
      ))}
    </group>
  );
}
