import { createInstances } from "@react-three/drei";
import { MeshBasicMaterial, MeshStandardMaterial } from "three";

/*
 * Shared instanced batches. Every decorative box in the world (walls, door
 * frames, chassis, stripes, road dashes...) is an <Box> instance, every glowing
 * lamp a <Glow>, every wheel a <Wheel>: three draw calls instead of hundreds.
 * Instances are ordinary children in the scene graph, so they follow their
 * parent group's transform and clicks bubble to the parent's handlers.
 */
export const [BoxInstances, Box] = createInstances();
export const [GlowInstances, Glow] = createInstances();
export const [WheelInstances, Wheel] = createInstances();

export const BOX_MATERIAL = new MeshStandardMaterial({ color: "#ffffff", roughness: 0.75, metalness: 0.05 });
export const GLOW_MATERIAL = new MeshBasicMaterial({ color: "#ffffff", toneMapped: false });
export const WHEEL_MATERIAL = new MeshStandardMaterial({ color: "#111827", roughness: 0.9 });
