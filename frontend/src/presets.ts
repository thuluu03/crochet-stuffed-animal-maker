import type { MannequinSlot } from "./types";

// export const PRESET_MESHES: PresetMesh[] = [
//   { id: "head", label: "Head", slotKind: "head" },
//   { id: "body", label: "Body", slotKind: "body" },
//   { id: "arm", label: "Arm", slotKind: "arm" },
//   { id: "leg", label: "Leg", slotKind: "leg" },
//   { id: "ear", label: "Ear", slotKind: "ear" },
//   { id: "tail", label: "Tail", slotKind: "tail" },
// ];

export const PART_SECTIONS = [
  {
    id: "head",
    label: "Head",
    items: [
      { id: "head-sphere", label: "Sphere Head", slotKind: "head" },
      { id: "head-cylinder", label: "Cylinder Head", slotKind: "head" },
      // { id: "head-pill", label: "Pill Head", slotKind: "head" },
    ],
  },
  {
    id: "body",
    label: "Body",
    items: [
      { id: "body-sphere", label: "Sphere Body", slotKind: "body" },
      { id: "body-cone", label: "Cone Body", slotKind: "body" },
      { id: "body-cylinder", label: "Cylinder Body", slotKind: "body" },
      // { id: "body-pill", label: "Pill Body", slotKind: "body" },
      { id: "body-teardrop", label: "Teardrop Body", slotKind: "body" },
    ],
  },
  {
    id: "limb",
    label: "Limbs",
    items: [
      { id: "limb-sphere", label: "Ball Limb", slotKind: "limb" },
      { id: "limb-cylinder", label: "Cylinder Limb", slotKind: "limb" },
      { id: "limb-teardrop", label: "Teardrop Limb", slotKind: "limb" },
    ],
  },
  {
    id: "ear",
    label: "Ears",
    items: [
      { id: "ear-sphere", label: "Ball Ear", slotKind: "ear" },
      { id: "ear-cylinder", label: "Tube Ear", slotKind: "ear" },
      { id: "ear-cone", label: "Horns", slotKind: "ear" },
      { id: "ear-circle", label: "Circular Ear", slotKind: "ear" },
      { id: "ear-teardrop", label: "Teardrop Ear", slotKind: "ear" },
    ],
  },
];

export const SHAPES = [
  { id: "sphere", label: "Sphere", slotKind: "shape" },
  { id: "cylinder", label: "Cylinder", slotKind: "shape" },
  { id: "cone", label: "Cone", slotKind: "shape" },
];

/** Mannequin attachment slots (positions in local space of mannequin) */
export const MANNEQUIN_SLOTS: MannequinSlot[] = [
  {
    id: "head",
    label: "Head",
    position: [0, 1.8, 0],
    rotation: [0, 0, 0],
    accepts: ["head"],
  },
  {
    id: "body",
    label: "Body",
    position: [0, 1.2, 0],
    rotation: [0, 0, 0],
    accepts: ["body"],
  },
  {
    id: "leftArm",
    label: "Left Arm",
    position: [-0.6, 1.4, 0],
    rotation: [0, 0, Math.PI / 6],
    accepts: ["arm", "limb"],
  },
  {
    id: "rightArm",
    label: "Right Arm",
    position: [0.6, 1.4, 0],
    rotation: [0, 0, -Math.PI / 6],
    accepts: ["arm", "limb"],
  },
  {
    id: "leftLeg",
    label: "Left Leg",
    position: [-0.25, 0.4, 0],
    rotation: [0, 0, 0],
    accepts: ["leg", "limb"],
  },
  {
    id: "rightLeg",
    label: "Right Leg",
    position: [0.25, 0.4, 0],
    rotation: [0, 0, 0],
    accepts: ["leg", "limb"],
  },
  {
    id: "leftEar",
    label: "Left Ear",
    position: [-0.35, 2.1, 0.3],
    rotation: [0, 0, Math.PI / 6],
    accepts: ["ear"],
  },
  {
    id: "rightEar",
    label: "Right Ear",
    position: [0.35, 2.1, 0.3],
    rotation: [0, 0, -Math.PI / 6],
    accepts: ["ear"],
  },
  {
    id: "tail",
    label: "Tail",
    position: [0, 0.5, 0.6],
    rotation: [Math.PI / 6, 0, 0],
    accepts: ["tail"],
  },
];

/** Number of horizontal segments (rows) per mesh type for segment coloring */
export const SEGMENT_COUNT_BY_MESH_ID: Record<string, number> = {
  "head": 8,
  "head-sphere": 8,
  "head-cylinder": 8,
  "body-sphere": 10,
  "body": 10,
  "body-cylinder": 10,
  "body-cone": 10,
  "limb-sphere": 6,
  "limb-cylinder": 6,
  "ear-sphere": 4,
  "ear-cylinder": 4,
  "ear": 4,
  "ear-cone": 4,
  "ear-circle": 4,
  "tail": 6,
  "body-teardrop": 8,
  "limb-teardrop": 6,
  "ear-teardrop": 4,
  "sphere": 8,
  "cylinder": 8,
  "cone": 8,
};

const DEFAULT_SEGMENT_COUNT = 8;

export function getSegmentCount(meshId: string): number {
  return SEGMENT_COUNT_BY_MESH_ID[meshId] ?? DEFAULT_SEGMENT_COUNT;
}
