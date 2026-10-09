import { Billboard } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import type { Group, Mesh, MeshBasicMaterial } from "three";
import type { Alert } from "../engine/alerts";
import { physicalRef } from "../sim/lookup";
import { anchorFor } from "./anchors";
import type { World } from "../sim/types";
import { useWorld } from "../store/useWorld";

const SEV = { high: "#f43f5e", medium: "#fbbf24", low: "#38bdf8" } as const;

function Marker({ alert, position, reducedMotion }: { alert: Alert; position: [number, number, number]; reducedMotion: boolean }) {
  const group = useRef<Group>(null);
  const ring = useRef<Mesh>(null);
  const select = useWorld((s) => s.select);
  const color = SEV[alert.severity];
  useFrame((state) => {
    const g = group.current;
    if (!g) return;
    // Keep a roughly constant on-screen size.
    const d = state.camera.position.distanceTo(g.position);
    g.scale.setScalar(Math.min(4, Math.max(0.9, d / 70)));
    if (ring.current && !reducedMotion) {
      const t = (state.clock.elapsedTime * 0.8 + position[0] * 0.01) % 1;
      ring.current.scale.setScalar(1 + t * 1.6);
      (ring.current.material as MeshBasicMaterial).opacity = 0.8 * (1 - t);
    }
  });
  return (
    <group ref={group} position={position}>
      <Billboard>
        <mesh
          onClick={(e) => {
            e.stopPropagation();
            select(alert.ref);
          }}
          name={`marker-${alert.id}`}
        >
          <circleGeometry args={[0.55, 24]} />
          <meshBasicMaterial color={color} toneMapped={false} />
        </mesh>
        <mesh ref={ring} raycast={() => null}>
          <ringGeometry args={[0.7, 0.85, 32]} />
          <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.6} />
        </mesh>
      </Billboard>
      <mesh position={[0, -1.1, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.04, 0.04, 1.6, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

/** Pulsing markers over every object with an open alert (one per object, worst first). */
export function AlertMarkers({ world, alerts, reducedMotion }: { world: World; alerts: Alert[]; reducedMotion: boolean }) {
  const seen = new Set<string>();
  const items: { alert: Alert; pos: [number, number, number] }[] = [];
  for (const a of alerts) {
    if (a.type === "SHIPMENT_LATE") continue;
    const phys = physicalRef(world, a.ref);
    if (!phys || seen.has(phys.id)) continue;
    seen.add(phys.id);
    const pos = anchorFor(world, a.ref);
    if (pos) items.push({ alert: a, pos });
  }
  return (
    <group>
      {items.map(({ alert, pos }) => (
        <Marker key={alert.id} alert={alert} position={pos} reducedMotion={reducedMotion} />
      ))}
    </group>
  );
}
