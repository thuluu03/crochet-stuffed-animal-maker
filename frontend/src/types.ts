import type { Vector3 } from "three";

/** Preset mesh definition (body part) */
export interface PresetMesh {
  id: string;
  label: string;
  /** Which slot it can attach to (or "any") */
  slotKind: string;
}

/** Slot on the mannequin */
export interface MannequinSlot {
  id: string;
  label: string;
  position: [number, number, number];
  rotation: [number, number, number];
  /** Which preset kinds can attach (e.g. ["arm"]) */
  accepts: string[];
}

/** A part placed on the mannequin */
export interface PlacedPart {
  instanceId: string;
  meshId: string;
  slotId: string;
  position: [number, number, number];
  scale: [number, number, number];
  rotation: [number, number, number];
  color: string;
  /** Optional row index -> hex for stitch coloring */
  rowColors?: Record<number, string>;
}

/** Payload sent to backend on save */
export interface DesignPayload {
  id?: string;
  name?: string;
  parts: {
    meshId: string;
    slotId: string;
    position: { x: number; y: number; z: number };
    scale: number;
    rotation: { x: number; y: number; z: number };
    color: string;
    rowColors?: Record<number, string>;
  }[];
  finalizedMeshes: {
    partInstanceId: string;
    meshId: string;
    slotId: string;
    points: number[];
    indices: number[];
    colors: string[];
    rowMapping?: Record<number, number[]>;
  }[];
}

export type { Vector3 };
