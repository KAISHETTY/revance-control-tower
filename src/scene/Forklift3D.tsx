import { Outlines } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { memo, useRef } from "react";
import type { Group } from "three";
import type { Forklift } from "../sim/types";
import { FORKLIFT_COLOR } from "./colors";
import { Box, Glow } from "./instances";
import { ACCENT, UNIT_BOX, angleDelta, stdMat, useInteractive } from "./interactive";
import type { Pose } from "./layout";

/** Small yellow forklift facing +z with mast and forks in front. */
export const Forklift3D = memo(
  function Forklift3D({ forklift, pose, reducedMotion }: { forklift: Forklift; pose: Pose; reducedMotion: boolean }) {
    const group = useRef<Group>(null);
    const placed = useRef(false);
    const { handlers, highlighted } = useInteractive({ kind: "forklift", id: forklift.id });

    useFrame((state, dt) => {
      const g = group.current;
      if (!g) return;
      const dx = pose.x - g.position.x;
      const dz = pose.z - g.position.z;
      if (!placed.current || reducedMotion) {
        g.position.set(pose.x, 0.2, pose.z);
        g.rotation.y = pose.rot;
        placed.current = true;
        return;
      }
      const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
      g.position.x += dx * k;
      g.position.z += dz * k;
      g.rotation.y += angleDelta(g.rotation.y, pose.rot) * k;
      if (Math.abs(dx) + Math.abs(dz) > 0.01) state.invalidate();
    });

    const low = forklift.battery < 15;
    return (
      <group ref={group} {...handlers} name={forklift.id}>
        <mesh
          geometry={UNIT_BOX}
          material={stdMat(FORKLIFT_COLOR, { roughness: 0.45 })}
          position={[0, 0.45, 0]}
          scale={[0.95, 0.6, 1.3]}
          castShadow
        >
          {highlighted ? <Outlines thickness={0.05} color={ACCENT} screenspace={false} /> : null}
        </mesh>
        <Box position={[0, 0.55, -0.6]} scale={[0.9, 0.5, 0.3]} color="#1f2937" />
        <Box position={[0, 1.45, -0.05]} scale={[0.9, 0.06, 0.9]} color="#111827" />
        <Box position={[0.4, 1.1, -0.05]} scale={[0.05, 0.7, 0.05]} color="#111827" />
        <Box position={[-0.4, 1.1, -0.05]} scale={[0.05, 0.7, 0.05]} color="#111827" />
        <Box position={[0, 1.0, 0.72]} scale={[0.7, 1.9, 0.08]} color="#374151" />
        <Box position={[0.22, 0.12, 1.15]} scale={[0.1, 0.05, 0.85]} color="#9ca3af" />
        <Box position={[-0.22, 0.12, 1.15]} scale={[0.1, 0.05, 0.85]} color="#9ca3af" />
        <Glow position={[0, 1.52, -0.05]} scale={[0.18, 0.08, 0.18]} color={low ? "#f43f5e" : "#22c55e"} />
      </group>
    );
  },
  (a, b) =>
    a.forklift.id === b.forklift.id &&
    a.forklift.battery < 15 === b.forklift.battery < 15 &&
    a.reducedMotion === b.reducedMotion &&
    a.pose.x === b.pose.x &&
    a.pose.z === b.pose.z &&
    a.pose.rot === b.pose.rot,
);
