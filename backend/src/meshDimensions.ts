import type { PartScale, Vector3 } from "./types.js";

/**
 * Physical scale hints for pattern generation and assembly adjacency.
 * Keep `CONNECTIVITY_RADIUS_BY_MESH_ID` in sync with
 * `frontend/src/checkConnectivity.ts` → `MESH_RADIUS`.
 *
 * For cylinders, `tubeRadius` / `height` tune crochet row counts; connectivity
 * still uses `connectivityRadius` × scale (same as frontend sphere overlap).
 */
export const STITCH_WIDTH = 0.06;
export const ROW_HEIGHT = 0.05;

export interface MeshDimensionEntry {
  connectivityRadius: number;
  /** Vertical extent for cylinders/cones/teardrops (pattern rows) */
  height?: number;
  /** Cross-section radius for tube-style pieces (stitches per round) */
  tubeRadius?: number;
}

/** Must match frontend MESH_RADIUS values for the same meshId keys. */
export const MESH_DIMENSIONS: Record<string, MeshDimensionEntry> = {
  "head-sphere": { connectivityRadius: 0.28 },
  "head-cylinder": { connectivityRadius: 0.28, height: 0.44, tubeRadius: 0.26 },
  "body-sphere": { connectivityRadius: 0.44 },
  "body-cylinder": { connectivityRadius: 0.44, height: 0.55, tubeRadius: 0.42 },
  "body-cone": { connectivityRadius: 0.45, height: 0.52, tubeRadius: 0.12 },
  "body-teardrop": { connectivityRadius: 0.44, height: 0.72, tubeRadius: 0.2 },
  "limb-sphere": { connectivityRadius: 0.15 },
  "limb-cylinder": { connectivityRadius: 0.3, height: 0.52, tubeRadius: 0.14 },
  "limb-teardrop": { connectivityRadius: 0.3, height: 0.48, tubeRadius: 0.14 },
  "ear-sphere": { connectivityRadius: 0.1 },
  "ear-cylinder": { connectivityRadius: 0.14, height: 0.22, tubeRadius: 0.08 },
  "ear-cone": { connectivityRadius: 0.2, height: 0.28, tubeRadius: 0.08 },
  "ear-circle": { connectivityRadius: 0.14, height: 0.06, tubeRadius: 0.14 },
  "ear-teardrop": { connectivityRadius: 0.2, height: 0.24, tubeRadius: 0.1 },
  tail: { connectivityRadius: 0.2, height: 0.35, tubeRadius: 0.08 },
  sphere: { connectivityRadius: 0.24 },
  cylinder: { connectivityRadius: 0.28, height: 0.48, tubeRadius: 0.26 },
  cone: { connectivityRadius: 0.28, height: 0.45, tubeRadius: 0.1 },
  "custom-teardrop": { connectivityRadius: 0.4, height: 0.65, tubeRadius: 0.18 },
  "body-custom-teardrop": { connectivityRadius: 0.44, height: 0.72, tubeRadius: 0.2 },
};

const DEFAULT_ENTRY: MeshDimensionEntry = { connectivityRadius: 0.3 };

export function scaleVector(scale: PartScale): Vector3 {
  if (typeof scale === "number") {
    return { x: scale, y: scale, z: scale };
  }
  return scale;
}

export function maxScaleFactor(scale: PartScale): number {
  const { x, y, z } = scaleVector(scale);
  return Math.max(x, y, z);
}

export function averageHorizontalScaleFactor(scale: PartScale): number {
  const { x, z } = scaleVector(scale);
  return (x + z) / 2;
}

export function getMeshDimensionEntry(meshId: string): MeshDimensionEntry {
  return MESH_DIMENSIONS[meshId] ?? DEFAULT_ENTRY;
}

export function getConnectivityRadius(meshId: string, scale: PartScale): number {
  return getMeshDimensionEntry(meshId).connectivityRadius * maxScaleFactor(scale);
}

/** Slot positions — keep in sync with `frontend/src/presets.ts` MANNEQUIN_SLOTS */
export const MANNEQUIN_SLOT_POSITIONS: Record<string, [number, number, number]> = {
  head: [0, 0.62, 0],
  body: [0, 0, 0],
  leftArm: [-0.5, 0, 0],
  rightArm: [0.5, 0, 0],
  leftLeg: [-0.16, -0.64, 0],
  rightLeg: [0.16, -0.64, 0],
  leftEar: [-0.18, 0.96, 0],
  rightEar: [0.18, 0.96, 0],
};

export const SLOT_LABELS: Record<string, string> = {
  head: "Head",
  body: "Body",
  leftArm: "Left Arm",
  rightArm: "Right Arm",
  leftLeg: "Left Leg",
  rightLeg: "Right Leg",
  leftEar: "Left Ear",
  rightEar: "Right Ear",
};

/** Short labels for pattern sections */
export const MESH_LABELS: Record<string, string> = {
  "head-sphere": "Sphere head",
  "head-cylinder": "Cylinder head",
  "body-sphere": "Sphere body",
  "body-cylinder": "Cylinder body",
  "body-cone": "Cone body",
  "body-teardrop": "Teardrop body",
  "body-custom-teardrop": "Custom teardrop body",
  "limb-sphere": "Ball limb",
  "limb-cylinder": "Cylinder limb",
  "limb-teardrop": "Teardrop limb",
  "ear-sphere": "Ball ear",
  "ear-cylinder": "Tube ear",
  "ear-cone": "Horn ear",
  "ear-circle": "Circular ear",
  "ear-teardrop": "Teardrop ear",
  sphere: "Sphere",
  cylinder: "Cylinder",
  cone: "Cone",
  "custom-teardrop": "Custom teardrop",
  tail: "Tail",
};

/** Must match frontend `SEGMENT_COUNT_BY_MESH_ID` for color-change placement. */
export const SEGMENT_COUNT_BY_MESH_ID: Record<string, number> = {
  head: 8,
  "head-sphere": 8,
  "head-cylinder": 8,
  "body-sphere": 10,
  body: 10,
  "body-cylinder": 10,
  "body-cone": 10,
  "limb-sphere": 6,
  "limb-cylinder": 6,
  "ear-sphere": 4,
  "ear-cylinder": 4,
  ear: 4,
  "ear-cone": 4,
  "ear-circle": 4,
  tail: 6,
  "body-teardrop": 8,
  "limb-teardrop": 6,
  "ear-teardrop": 4,
  sphere: 8,
  cylinder: 8,
  cone: 8,
  "custom-teardrop": 8,
  "body-custom-teardrop": 10,
};

const DEFAULT_SEGMENT_COUNT = 8;

export function slotLabel(slotId: string): string {
  return SLOT_LABELS[slotId] ?? slotId;
}

export function meshLabel(meshId: string): string {
  return MESH_LABELS[meshId] ?? meshId;
}

export function getSegmentCount(meshId: string): number {
  return SEGMENT_COUNT_BY_MESH_ID[meshId] ?? DEFAULT_SEGMENT_COUNT;
}
