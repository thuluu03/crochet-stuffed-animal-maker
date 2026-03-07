import type { PresetMesh, MannequinSlot } from "./types";

export const PRESET_MESHES: PresetMesh[] = [
  { id: "head", label: "Head", slotKind: "head" },
  { id: "body", label: "Body", slotKind: "body" },
  { id: "arm", label: "Arm", slotKind: "arm" },
  { id: "leg", label: "Leg", slotKind: "leg" },
  { id: "ear", label: "Ear", slotKind: "ear" },
  { id: "tail", label: "Tail", slotKind: "tail" },
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
    accepts: ["arm"],
  },
  {
    id: "rightArm",
    label: "Right Arm",
    position: [0.6, 1.4, 0],
    rotation: [0, 0, -Math.PI / 6],
    accepts: ["arm"],
  },
  {
    id: "leftLeg",
    label: "Left Leg",
    position: [-0.25, 0.4, 0],
    rotation: [0, 0, 0],
    accepts: ["leg"],
  },
  {
    id: "rightLeg",
    label: "Right Leg",
    position: [0.25, 0.4, 0],
    rotation: [0, 0, 0],
    accepts: ["leg"],
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
