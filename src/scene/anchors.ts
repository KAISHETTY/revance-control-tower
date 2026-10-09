import { physicalRef, resolveRef } from "../sim/lookup";
import type { ObjectRef, World } from "../sim/types";
import { forkliftPose, siteLayout, truckPose } from "./layout";

/** World position (x, y, z) of an object's marker anchor. */
export function anchorFor(world: World, ref: ObjectRef): [number, number, number] | undefined {
  const phys = physicalRef(world, ref);
  if (!phys) return undefined;
  const r = resolveRef(world, phys);
  if (!r) return undefined;
  const lay = siteLayout(r.site);
  switch (r.kind) {
    case "truck": {
      const p = truckPose(world, r.truck, r.site);
      return [p.x, r.truck.location === "road" ? 7 : 4.6, p.z];
    }
    case "dock":
      return [lay.docks[r.dock.id].pad.x, 4.2, lay.docks[r.dock.id].pad.z];
    case "bay":
      return [lay.bays[r.bay.id].pos.x, 4, lay.bays[r.bay.id].pos.z];
    case "coldRoom":
      return [lay.coldRooms[r.room.id].center.x, 5, lay.coldRooms[r.room.id].center.z];
    case "forklift": {
      const p = forkliftPose(r.site, r.forklift);
      return [p.x, 2.8, p.z];
    }
    case "site":
      return [lay.origin.x, 8, lay.origin.z];
    default:
      return undefined;
  }
}
