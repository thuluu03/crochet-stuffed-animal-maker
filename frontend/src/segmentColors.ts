import * as THREE from "three";
import { roundedCylinderGeometry, roundedConeGeometry } from "./roundedGeometry";

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

function makeSegmentTexture(
  segmentCount: number,
  baseColor: string,
  segmentColors?: Record<number, string>,
): THREE.DataTexture {
  const data = new Uint8Array(segmentCount * 4);
  for (let s = 0; s < segmentCount; s++) {
    const [r, g, b] = hexToRgb(segmentColors?.[s] ?? baseColor);
    data[s * 4]     = Math.round(r * 255);
    data[s * 4 + 1] = Math.round(g * 255);
    data[s * 4 + 2] = Math.round(b * 255);
    data[s * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, segmentCount, 1, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

function applySegmentUVs(
  geom: THREE.BufferGeometry,
  minY: number,
  maxY: number,
  yOffset = 0,
): void {
  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const spanY = maxY - minY || 1;
  const uvs = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) + yOffset;
    uvs[i * 2]     = Math.max(0, Math.min(1, (y - minY) / spanY)); // U = normalized Y
    uvs[i * 2 + 1] = 0.5; // V = center of 1px-tall texture
  }
  geom.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
}

export type SegmentColored = {
  geometry: THREE.BufferGeometry;
  texture: THREE.DataTexture;
};

/**
 * Set up UV-based segment coloring. Returns geometry with UV.x = normalized Y,
 * and a 1D DataTexture (NearestFilter) mapping segment index → color.
 * The fragment shader samples per-pixel so cuts are perfectly sharp with no jaggies.
 */
export function addSegmentVertexColors(
  geometry: THREE.BufferGeometry,
  segmentCount: number,
  baseColor: string,
  segmentColors?: Record<number, string>,
): SegmentColored {
  const geom = geometry.clone();
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  applySegmentUVs(geom, box.min.y, box.max.y, 0);
  return { geometry: geom, texture: makeSegmentTexture(segmentCount, baseColor, segmentColors) };
}

/**
 * Like addSegmentVertexColors but maps vertex Y using worldY = localY + yOffset
 * against the given [minY, maxY] range. Use for multi-part shapes (e.g. teardrop).
 */
export function addSegmentVertexColorsWithRange(
  geometry: THREE.BufferGeometry,
  segmentCount: number,
  baseColor: string,
  segmentColors: Record<number, string> | undefined,
  minY: number,
  maxY: number,
  yOffset: number,
): SegmentColored {
  const geom = geometry.clone();
  applySegmentUVs(geom, minY, maxY, yOffset);
  return { geometry: geom, texture: makeSegmentTexture(segmentCount, baseColor, segmentColors) };
}

/** Teardrop shape Y range in local group space: sphere -0.18..0.18, cone 0..0.7 */
export const TEARDROP_MIN_Y = -0.18;
export const TEARDROP_MAX_Y = 0.7;

export function isTeardropType(meshId: string): boolean {
  return (
    meshId === "body-teardrop" ||
    meshId === "limb-teardrop" ||
    meshId === "ear-teardrop" ||
    meshId === "custom-teardrop" ||
    meshId === "body-custom-teardrop"
  );
}

/** Return base BufferGeometry for segment coloring, or null if not supported (e.g. Teardrop). */
export function getBaseGeometry(meshId: string): THREE.BufferGeometry | null {
  if (isTeardropType(meshId)) return null;
  switch (meshId) {
    case "head":
    case "head-sphere":
      return new THREE.SphereGeometry(0.28, 28, 20);
    case "head-cylinder":
      return roundedCylinderGeometry(0.22, 0.26, 0.46, 32);
    case "body-sphere":
      return new THREE.SphereGeometry(0.44, 32, 24);
    case "body":
    case "body-cylinder":
      return roundedCylinderGeometry(0.34, 0.4, 0.82, 36);
    case "body-cone":
      return roundedConeGeometry(0.4, 0.82, 28);
    case "limb-sphere":
      return new THREE.SphereGeometry(0.15, 20, 16);
    case "limb-cylinder":
      return roundedCylinderGeometry(0.08, 0.09, 0.56, 24);
    case "ear-sphere":
      return new THREE.SphereGeometry(0.1, 18, 14);
    case "ear-cylinder":
      return roundedCylinderGeometry(0.07, 0.07, 0.24, 24);
    case "ear":
    case "ear-cone":
      return roundedConeGeometry(0.12, 0.3, 18);
    case "ear-circle":
      return roundedCylinderGeometry(0.14, 0.14, 0.035, 32);
    case "tail":
      return new THREE.SphereGeometry(0.2, 16, 12);
    case "sphere":
      return new THREE.SphereGeometry(0.24, 24, 18);
    case "cylinder":
      return roundedCylinderGeometry(0.16, 0.16, 0.5, 28);
    case "cone":
      return roundedConeGeometry(0.2, 0.5, 20);
    default:
      return new THREE.BoxGeometry(0.3, 0.3, 0.3);
  }
}
