import { Edges } from "@react-three/drei";
import type { ColdRoom, Site, World } from "../sim/types";
import { COLD_COLORS, type ScenePalette } from "./colors";
import { Dock3D } from "./Dock3D";
import { Forklift3D } from "./Forklift3D";
import { ACCENT, UNIT_BOX, stdMat, useInteractive } from "./interactive";
import { forkliftPose, siteLayout, WALL_HEIGHT, type SiteLayout } from "./layout";
import { StockBays } from "./StockBay3D";

const COLD_H = 3.0;

function ColdRoom3D({ room, lay }: { room: ColdRoom; lay: SiteLayout }) {
  const { handlers, highlighted } = useInteractive({ kind: "coldRoom", id: room.id });
  const c = lay.coldRooms[room.id];
  const edge = highlighted ? ACCENT : COLD_COLORS[room.status];
  return (
    <group name={room.id}>
      <mesh position={[c.center.x, 0.2 + COLD_H / 2, c.center.z]} scale={[c.w, COLD_H, c.d]} geometry={UNIT_BOX} {...handlers}>
        <meshStandardMaterial color="#7dd3fc" transparent opacity={highlighted ? 0.26 : 0.16} depthWrite={false} roughness={0.2} />
        <Edges color={edge} lineWidth={1} />
      </mesh>
      {/* Refrigeration unit on top */}
      <mesh
        position={[c.center.x + c.w / 2 - 1.3, 0.2 + COLD_H + 0.35, c.center.z - c.d / 2 + 1]}
        scale={[1.8, 0.7, 1.2]}
        geometry={UNIT_BOX}
        material={stdMat("#cbd5e1", { metalness: 0.4, roughness: 0.4 })}
        castShadow
      />
      <mesh
        position={[c.center.x + c.w / 2 - 1.3, 0.2 + COLD_H + 0.72, c.center.z - c.d / 2 + 1]}
        scale={[0.9, 0.04, 0.9]}
        geometry={UNIT_BOX}
        material={stdMat(COLD_COLORS[room.status], { emissive: COLD_COLORS[room.status], emissiveIntensity: 1.2 })}
      />
      {/* Cold floor tint */}
      <mesh position={[c.center.x, 0.205, c.center.z]} scale={[c.w - 0.2, 0.01, c.d - 0.2]} geometry={UNIT_BOX} raycast={() => null}>
        <meshStandardMaterial color="#38bdf8" transparent opacity={0.18} />
      </mesh>
    </group>
  );
}

function Building({ lay, palette }: { lay: SiteLayout; palette: ScenePalette }) {
  const { origin: o, width: w, depth: d } = lay;
  const t = 0.3;
  const wall = stdMat(palette.wall, { roughness: 0.85 });
  const low = 1.1;
  return (
    <group>
      <mesh
        position={[o.x, 0.1, o.z]}
        scale={[w, 0.2, d]}
        geometry={UNIT_BOX}
        material={stdMat(palette.floor, { roughness: 0.95 })}
        receiveShadow
      />
      {/* Full-height back and left walls; low front and right walls as a cutaway */}
      <mesh
        position={[o.x, WALL_HEIGHT / 2, o.z - d / 2]}
        scale={[w, WALL_HEIGHT, t]}
        geometry={UNIT_BOX}
        material={wall}
        castShadow
        receiveShadow
      />
      <mesh
        position={[o.x - w / 2, WALL_HEIGHT / 2, o.z]}
        scale={[t, WALL_HEIGHT, d]}
        geometry={UNIT_BOX}
        material={wall}
        castShadow
        receiveShadow
      />
      <mesh position={[o.x + w / 2, low / 2, o.z]} scale={[t, low, d]} geometry={UNIT_BOX} material={wall} castShadow receiveShadow />
      <mesh position={[o.x, low / 2, o.z + d / 2]} scale={[w, low, t]} geometry={UNIT_BOX} material={wall} castShadow receiveShadow />
      {/* Roof edge trim on the tall walls */}
      <mesh
        position={[o.x, WALL_HEIGHT + 0.08, o.z - d / 2]}
        scale={[w + 0.2, 0.16, t + 0.2]}
        geometry={UNIT_BOX}
        material={stdMat("#334155")}
      />
      <mesh
        position={[o.x - w / 2, WALL_HEIGHT + 0.08, o.z]}
        scale={[t + 0.2, 0.16, d + 0.2]}
        geometry={UNIT_BOX}
        material={stdMat("#334155")}
      />
      {/* Forklift lane along the docks */}
      <mesh
        position={[o.x, 0.205, o.z + d / 2 - 2]}
        scale={[w - 2, 0.01, 0.12]}
        geometry={UNIT_BOX}
        material={stdMat("#facc15", { emissive: "#facc15", emissiveIntensity: 0.2 })}
      />
      <mesh
        position={[o.x, 0.205, o.z + d / 2 - 3.4]}
        scale={[w - 2, 0.01, 0.12]}
        geometry={UNIT_BOX}
        material={stdMat("#facc15", { emissive: "#facc15", emissiveIntensity: 0.2 })}
      />
      {/* Apron and yard */}
      <mesh
        position={[o.x, 0.03, o.z + d / 2 + 12]}
        scale={[w + 14, 0.06, 24]}
        geometry={UNIT_BOX}
        material={stdMat(palette.road, { roughness: 0.95 })}
        receiveShadow
      />
      {lay.yard.map((p, i) => (
        <mesh key={i} position={[p.x + 2.2, 0.07, p.z]} scale={[0.12, 0.01, 9]} geometry={UNIT_BOX} material={stdMat(palette.roadLine)} />
      ))}
      {/* Charger */}
      <mesh
        position={[lay.charger.x - 0.4, 0.8, lay.charger.z]}
        scale={[0.4, 1.2, 0.8]}
        geometry={UNIT_BOX}
        material={stdMat("#334155")}
        castShadow
      />
      <mesh
        position={[lay.charger.x - 0.18, 1.2, lay.charger.z]}
        scale={[0.05, 0.2, 0.3]}
        geometry={UNIT_BOX}
        material={stdMat("#22c55e", { emissive: "#22c55e", emissiveIntensity: 1.5 })}
      />
    </group>
  );
}

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
