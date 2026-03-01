/**
 * Design encoding sent from frontend and stored by backend.
 * All mesh geometry is represented by points; colors are per-part or per-vertex/row.
 */

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface DesignPart {
  /** Preset mesh id (e.g. "head", "arm", "leg") */
  meshId: string;
  /** Slot on mannequin (e.g. "head", "leftArm") */
  slotId: string;
  /** Position relative to slot */
  position: Vector3;
  /** Uniform scale */
  scale: number;
  /** Rotation in radians (euler) */
  rotation: Vector3;
  /** Hex color for the whole part */
  color: string;
  /** Optional: per-row or per-stitch colors for crochet (row index -> hex) */
  rowColors?: Record<number, string>;
}

/** Final mesh: flattened geometry for storage (all vertices and faces) */
export interface StoredMesh {
  /** Unique id for this part instance */
  partInstanceId: string;
  meshId: string;
  slotId: string;
  /** World-space or local vertices [x,y,z, x,y,z, ...] */
  points: number[];
  /** Face indices (triplets for triangles) or quad indices */
  indices: number[];
  /** Per-vertex or per-face colors (hex), or single color applied to all */
  colors: string[];
  /** Optional row/stitch metadata for crochet (row index -> vertex/face indices) */
  rowMapping?: Record<number, number[]>;
}

export interface Design {
  id: string;
  name?: string;
  /** Parts as edited by user (used to reconstruct or re-export) */
  parts: DesignPart[];
  /** Finalized mesh data: all points and colors for backend storage */
  finalizedMeshes: StoredMesh[];
  createdAt: string;
  updatedAt: string;
}
