import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { Group } from "three";
import type { Truck } from "../sim/types";
import { CARRIER_COLORS } from "./colors";
import { Box, Wheel } from "./instances";
import { ACCENT, UNIT_BOX, angleDelta, stdMat, useInteractive } from "./interactive";
import type { Pose } from "./layout";

const WHEELS: [number, number][] = [
  [-1.05, 3.3],
  [1.05, 3.3],
  [-1.05, -2.6],
  [1.05, -2.6],
  [-1.05, -3.5],
  [1.05, -3.5],
];

interface Props {
  truck: Truck;
  pose: Pose;
  scale: number;
  reducedMotion: boolean;
}

/**
 * Low-poly truck facing +z: cab in front, trailer behind. Reefers have a white
 * box with a blue refrigeration unit on the front. Trailer and cab are real
 * meshes (for outlines); the small parts are shared instances.
 */
export const Truck3D = memo(
  function Truck3D({ truck, pose, scale, reducedMotion }: Props) {
    const group = useRef<Group>(null);
    const placed = useRef(false);
    const { handlers, highlighted } = useInteractive({ kind: "truck", id: truck.id });
    const reefer = truck.kind === "reefer";
    const cab = CARRIER_COLORS[truck.carrier] ?? "#475569";

    useFrame((state, dt) => {
      const g = group.current;
      if (!g) return;
      const dx = pose.x - g.position.x;
      const dz = pose.z - g.position.z;
      if (!placed.current || reducedMotion || dx * dx + dz * dz > 80 * 80) {
        g.position.set(pose.x, 0, pose.z);
        g.rotation.y = pose.rot;
        g.scale.setScalar(scale);
        placed.current = true;
        return;
      }
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 3);
      g.position.x += dx * k;
      g.position.z += dz * k;
      g.rotation.y += angleDelta(g.rotation.y, pose.rot) * k;
      g.scale.setScalar(g.scale.x + (scale - g.scale.x) * k);
      if (Math.abs(dx) + Math.abs(dz) > 0.02 || Math.abs(angleDelta(g.rotation.y, pose.rot)) > 0.002) state.invalidate();
    });

    return (
      <group ref={group} {...handlers} name={truck.id}>
        <mesh
          geometry={UNIT_BOX}
          material={stdMat(reefer ? "#f4f7fb" : "#d4dae3", { roughness: 0.55 })}
          position={[0, 1.95, -0.9]}
          scale={[2.4, 2.7, 6.4]}
          castShadow
          receiveShadow
        >
          {highlighted ? <Outlines thickness={0.06} color={ACCENT} screenspace={false} /> : null}
        </mesh>
        <mesh
          geometry={UNIT_BOX}
          material={stdMat(cab, { roughness: 0.45, metalness: 0.15 })}
          position={[0, 1.55, 3.45]}
          scale={[2.3, 1.9, 1.7]}
          castShadow
        >
          {highlighted ? <Outlines thickness={0.06} color={ACCENT} screenspace={false} /> : null}
        </mesh>
        <Box position={[0, 1.15, -0.9]} scale={[2.42, 0.22, 6.2]} color={cab} />
        {reefer ? <Box position={[0, 2.55, 2.45]} scale={[1.9, 1.3, 0.35]} color="#0ea5e9" /> : null}
        <Box position={[0, 0.55, 0.2]} scale={[2.0, 0.3, 8.4]} color="#1f2937" />
        <Box position={[0, 1.95, 4.31]} scale={[2.0, 0.75, 0.04]} color="#0b1220" />
        {WHEELS.map(([x, z], i) => (
          <Wheel key={i} position={[x, 0.45, z]} />
        ))}
      </group>
    );
  },
  (a, b) =>
    a.truck.id === b.truck.id &&
    a.truck.kind === b.truck.kind &&
    a.truck.carrier === b.truck.carrier &&
    a.scale === b.scale &&
    a.reducedMotion === b.reducedMotion &&
    a.pose.x === b.pose.x &&
    a.pose.z === b.pose.z &&
    a.pose.rot === b.pose.rot,
);
