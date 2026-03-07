import * as THREE from "three";

/** Parse hex "#rrggbb" to [r, g, b] in 0–1 */
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 0xff) / 255, (n & 0xff) / 255];
}

/**
 * Clone geometry and add a vertex color attribute so each vertex is colored by its
 * horizontal segment (Y in local space). Segments are indexed 0..segmentCount-1 from bottom to top.
 */
export function addSegmentVertexColors(
  geometry: THREE.BufferGeometry,
  segmentCount: number,
  baseColor: string,
  segmentColors?: Record<number, string>
): THREE.BufferGeometry {
  const geom = geometry.clone();
  geom.computeBoundingBox();
  const box = geom.boundingBox!;
  const minY = box.min.y;
  const maxY = box.max.y;
  const spanY = maxY - minY || 1;

  const pos = geom.getAttribute("position") as THREE.BufferAttribute;
  const vertexCount = pos.count;
  const colors = new Float32Array(vertexCount * 3);

  for (let i = 0; i < vertexCount; i++) {
    const y = pos.getY(i);
    const t = (y - minY) / spanY;
    const seg = Math.min(
      Math.max(0, Math.floor(t * segmentCount)),
      segmentCount - 1
    );
    const hex = segmentColors?.[seg] ?? baseColor;
    const rgb = hexToRgb(hex);
    colors[i * 3] = rgb[0];
    colors[i * 3 + 1] = rgb[1];
    colors[i * 3 + 2] = rgb[2];
  }

  // console.log(colors); 
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geom;
}

export function isTeardropType(meshId: string): boolean {
  return (
    meshId === "body-teardrop" ||
    meshId === "limb-teardrop" ||
    meshId === "ear-teardrop"
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
      return new THREE.CylinderGeometry(0.22, 0.26, 0.46, 24, 24); // 4th argument is segments
    case "body-sphere":
      return new THREE.SphereGeometry(0.44, 32, 24);
    case "body":
    case "body-cylinder":
      return new THREE.CylinderGeometry(0.34, 0.4, 0.82, 28, 24); // 4th argument is segments
    case "body-cone":
      return new THREE.CylinderGeometry(0.001, 0.4, 0.82, 28, 24); // 4th argument is segments
    case "limb-sphere":
      return new THREE.SphereGeometry(0.15, 20, 16);
    case "limb-cylinder":
      return new THREE.CylinderGeometry(0.08, 0.09, 0.56, 18, 24); // 4th argument is segments
    case "ear-sphere":
      return new THREE.SphereGeometry(0.1, 18, 14);
    case "ear-cylinder":
      return new THREE.CylinderGeometry(0.07, 0.07, 0.24, 18, 24); // 4th argument is segments
    case "ear":
    case "ear-cone":
      // return new THREE.ConeGeometry(0.12, 0.3, 18, 24); // 4th argument is segments
      return new THREE.CylinderGeometry(0.001, 0.12, 0.3, 18, 24); // 4th argument is segments
    case "ear-circle":
      return new THREE.CylinderGeometry(0.14, 0.14, 0.035, 24, 24); // 4th argument is segments
    case "tail":
      return new THREE.SphereGeometry(0.2, 16, 12);
    case "sphere":
      return new THREE.SphereGeometry(0.24, 24, 18);
    case "cylinder":
      return new THREE.CylinderGeometry(0.16, 0.16, 0.5, 20, 24); // 4th argument is segments
    case "cone":
      // return new THREE.ConeGeometry(0.2, 0.5, 20, 24); // 4th argument is segments
      return new THREE.CylinderGeometry(0.001, 0.2, 0.5, 20, 24); // 4th argument is segments
    default:
      return new THREE.BoxGeometry(0.3, 0.3, 0.3);
  }
}
