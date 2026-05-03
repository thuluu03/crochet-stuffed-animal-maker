/** Must stay in sync with backend/src/meshDimensions.ts + crochetPattern.ts */
const STITCH_WIDTH = 0.06;
const ROW_HEIGHT = 0.05;

interface MeshDim {
  connectivityRadius: number;
  height?: number;
  tubeRadius?: number;
}

const MESH_DIMS: Record<string, MeshDim> = {
  head: { connectivityRadius: 0.28 },
  "head-sphere": { connectivityRadius: 0.28 },
  "head-cylinder": { connectivityRadius: 0.28, height: 0.44, tubeRadius: 0.26 },
  body: { connectivityRadius: 0.44 },
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

function shapeFamily(meshId: string): "sphere" | "cylinder" | "cone" | "teardrop" {
  if (meshId.includes("teardrop")) return "teardrop";
  if (meshId.includes("cone")) return "cone";
  if (meshId.includes("cylinder")) return "cylinder";
  return "sphere";
}

export function computePatternRowCount(
  meshId: string,
  scale: [number, number, number],
): number {
  const [sx, sy, sz] = scale;
  const dim = MESH_DIMS[meshId] ?? { connectivityRadius: 0.3 };
  const family = shapeFamily(meshId);

  if (family === "cylinder" || family === "teardrop") {
    const avgHoriz = (sx + sz) / 2;
    const tubeR = (dim.tubeRadius ?? dim.connectivityRadius) * avgHoriz;
    const height = (dim.height ?? dim.connectivityRadius * 2) * sy;
    const circ = Math.max(6, Math.round((2 * Math.PI * tubeR) / STITCH_WIDTH));
    const circumference = Math.max(1, Math.round(circ / 6) * 6);
    const hRows = Math.max(1, Math.round(height / ROW_HEIGHT));
    return 1 + (circumference / 6 - 1) + hRows + (circumference / 6 - 1) + 1;
  }

  if (family === "cone") {
    const height = (dim.height ?? dim.connectivityRadius * 1.2) * sy;
    return Math.max(1, Math.round(height / ROW_HEIGHT));
  }

  // sphere
  const smallerH = Math.min(sx, sz);
  const increaseRows = Math.max(1, Math.round(7 * Math.sqrt(smallerH) - 1));
  const regularRows = Math.max(1, Math.round((increaseRows + 1) * sy));
  return increaseRows + regularRows + increaseRows;
}
