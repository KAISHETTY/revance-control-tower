import { Outlines } from "@react-three/drei";
import type { Dock } from "../sim/types";
import { DOCK_COLORS } from "./colors";
import { ACCENT, UNIT_BOX, stdMat, useInteractive } from "./interactive";
import { WALL_HEIGHT, type DockLayout } from "./layout";

/** Door frame on the front wall plus a status-colored pad outside it. */
export function Dock3D({ dock, layout }: { dock: Dock; layout: DockLayout }) {
  const { handlers, highlighted } = useInteractive({ kind: "dock", id: dock.id });
  const color = DOCK_COLORS[dock.status];
  const { door, pad } = layout;
  return (
    <group {...handlers} name={dock.id}>
      <mesh
        geometry={UNIT_BOX}
        material={stdMat(color, { emissive: color, emissiveIntensity: 0.35, roughness: 0.5 })}
        position={[pad.x, 0.04, pad.z]}
        scale={[3.2, 0.08, 2.2]}
        receiveShadow
      >
        {highlighted ? <Outlines thickness={0.08} color={ACCENT} screenspace={false} /> : null}
      </mesh>
      {/* Door frame */}
      <mesh
        geometry={UNIT_BOX}
        material={stdMat("#475569")}
        position={[door.x - 1.5, WALL_HEIGHT / 2, door.z]}
        scale={[0.22, WALL_HEIGHT, 0.4]}
        castShadow
      />
      <mesh
        geometry={UNIT_BOX}
        material={stdMat("#475569")}
        position={[door.x + 1.5, WALL_HEIGHT / 2, door.z]}
        scale={[0.22, WALL_HEIGHT, 0.4]}
        castShadow
      />
      <mesh
        geometry={UNIT_BOX}
        material={stdMat("#475569")}
        position={[door.x, WALL_HEIGHT - 0.12, door.z]}
        scale={[3.2, 0.24, 0.4]}
        castShadow
      />
      {/* Bumpers */}
      <mesh geometry={UNIT_BOX} material={stdMat("#111827")} position={[door.x - 1.1, 1.0, door.z + 0.3]} scale={[0.3, 0.4, 0.2]} />
      <mesh geometry={UNIT_BOX} material={stdMat("#111827")} position={[door.x + 1.1, 1.0, door.z + 0.3]} scale={[0.3, 0.4, 0.2]} />
      {dock.status === "blocked" ? (
        <>
          <mesh
            geometry={UNIT_BOX}
            material={stdMat("#f43f5e", { emissive: "#f43f5e", emissiveIntensity: 0.6 })}
            position={[pad.x, 1.0, pad.z + 0.6]}
            scale={[3.0, 0.18, 0.18]}
          />
          <mesh geometry={UNIT_BOX} material={stdMat("#f8fafc")} position={[pad.x - 1.3, 0.5, pad.z + 0.6]} scale={[0.15, 1.0, 0.15]} />
          <mesh geometry={UNIT_BOX} material={stdMat("#f8fafc")} position={[pad.x + 1.3, 0.5, pad.z + 0.6]} scale={[0.15, 1.0, 0.15]} />
        </>
      ) : null}
    </group>
  );
}
