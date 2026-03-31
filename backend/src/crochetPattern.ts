import type { Design, DesignPart, StoredMesh } from "./types.js";
import {
  ROW_HEIGHT,
  STITCH_WIDTH,
  averageHorizontalScaleFactor,
  getConnectivityRadius,
  getMeshDimensionEntry,
  getSegmentCount,
  meshLabel,
  MANNEQUIN_SLOT_POSITIONS,
  scaleVector,
  slotLabel,
} from "./meshDimensions.js";

const SLOT_ORDER = [
  "body",
  "head",
  "leftArm",
  "rightArm",
  "leftLeg",
  "rightLeg",
  "leftEar",
  "rightEar",
];

function sortKey(slotId: string): number {
  const i = SLOT_ORDER.indexOf(slotId);
  return i === -1 ? 999 : i;
}

function partWorldCenter(part: DesignPart): [number, number, number] {
  const sp = MANNEQUIN_SLOT_POSITIONS[part.slotId] ?? [0, 0, 0];
  return [
    sp[0] + part.position.x,
    sp[1] + part.position.y,
    sp[2] + part.position.z,
  ];
}

function dist3(
  a: [number, number, number],
  b: [number, number, number],
): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Bounding-sphere radius from flattened xyz points; null if insufficient data. */
export function boundingSphereRadiusFromPoints(
  points: number[],
): number | null {
  if (points.length < 9) return null;
  const n = points.length / 3;
  let cx = 0;
  let cy = 0;
  let cz = 0;
  for (let i = 0; i < points.length; i += 3) {
    cx += points[i];
    cy += points[i + 1];
    cz += points[i + 2];
  }
  cx /= n;
  cy /= n;
  cz /= n;
  let maxD = 0;
  for (let i = 0; i < points.length; i += 3) {
    const d = Math.hypot(
      points[i] - cx,
      points[i + 1] - cy,
      points[i + 2] - cz,
    );
    if (d > maxD) maxD = d;
  }
  return maxD;
}

function halfExtentsFromPoints(
  points: number[],
): { x: number; y: number; z: number } | null {
  if (points.length < 9) return null;
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (let i = 0; i < points.length; i += 3) {
    minX = Math.min(minX, points[i]);
    minY = Math.min(minY, points[i + 1]);
    minZ = Math.min(minZ, points[i + 2]);
    maxX = Math.max(maxX, points[i]);
    maxY = Math.max(maxY, points[i + 1]);
    maxZ = Math.max(maxZ, points[i + 2]);
  }
  return {
    x: (maxX - minX) / 2,
    y: (maxY - minY) / 2,
    z: (maxZ - minZ) / 2,
  };
}

function clampStitches(n: number, min = 6): number {
  return Math.max(min, Math.round(n));
}

export function stitchesForCircumference(radius: number): number {
  return clampStitches((2 * Math.PI * radius) / STITCH_WIDTH);
}

export function rowsForLength(length: number): number {
  return Math.max(1, Math.round(length / ROW_HEIGHT));
}

function shapeFamily(
  meshId: string,
): "sphere" | "cylinder" | "cone" | "teardrop" {
  if (meshId.includes("teardrop")) return "teardrop";
  if (meshId.includes("cone")) return "cone";
  if (meshId.includes("cylinder")) return "cylinder";
  return "sphere";
}

function colorHint(mesh: StoredMesh | undefined, part: DesignPart): string {
  const c = mesh?.colors?.[0] ?? part.color;
  return c || "(use your chosen main color)";
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().toLowerCase();
  const match = normalized.match(/^#?([0-9a-f]{6})$/);
  if (!match) return null;
  const value = parseInt(match[1], 16);
  return {
    r: (value >> 16) & 0xff,
    g: (value >> 8) & 0xff,
    b: value & 0xff,
  };
}

function describeColor(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;

  const r = rgb.r / 255;
  const g = rgb.g / 255;
  const b = rgb.b / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;

  let hue = 0;
  if (delta !== 0) {
    if (max === r) hue = ((g - b) / delta) % 6;
    else if (max === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
    hue *= 60;
    if (hue < 0) hue += 360;
  }

  const saturation =
    delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));

  let base = "gray";
  if (saturation < 0.12) {
    if (lightness < 0.12) base = "black";
    else if (lightness > 0.88) base = "white";
    else base = "gray";
  } else if (hue < 15 || hue >= 345) {
    base = "red";
  } else if (hue < 45) {
    base = "orange";
  } else if (hue < 70) {
    base = "yellow";
  } else if (hue < 155) {
    base = "green";
  } else if (hue < 190) {
    base = "teal";
  } else if (hue < 255) {
    base = "blue";
  } else if (hue < 320) {
    base = "purple";
  } else {
    base = "pink";
  }

  let prefix = "";
  if (base !== "black" && base !== "white") {
    if (lightness < 0.35) prefix = "dark ";
    else if (lightness > 0.72) prefix = "light ";
  }

  return `${prefix}${base} (${hex})`;
}

type ColorRun = {
  startRow: number;
  endRow: number;
  color: string;
};

function buildColorRuns(
  part: DesignPart,
  baseColor: string,
  totalRows: number,
): ColorRun[] {
  const segmentCount = getSegmentCount(part.meshId);
  if (segmentCount <= 0 || totalRows <= 0) {
    return [{ startRow: 1, endRow: totalRows, color: baseColor }];
  }

  const colorForSegment = (segmentIndex: number): string =>
    part.rowColors?.[segmentIndex] ?? baseColor;

  const runs: ColorRun[] = [];
  for (let segmentIndex = 0; segmentIndex < segmentCount; segmentIndex++) {
    const startRow = Math.floor((segmentIndex * totalRows) / segmentCount) + 1;
    const endRow = Math.floor(((segmentIndex + 1) * totalRows) / segmentCount);
    if (startRow > totalRows || endRow < startRow) continue;
    const color = colorForSegment(segmentIndex);
    const previousRun = runs[runs.length - 1];
    if (
      previousRun &&
      previousRun.color === color &&
      previousRun.endRow + 1 >= startRow
    ) {
      previousRun.endRow = endRow;
      continue;
    }
    runs.push({ startRow, endRow, color });
  }

  if (runs.length === 0) {
    return [{ startRow: 1, endRow: totalRows, color: baseColor }];
  }
  return runs;
}

function rowLabel(startRow: number, endRow: number): string {
  return startRow === endRow ? `Row ${startRow}` : `Rows ${startRow}-${endRow}`;
}

function lineWithInlineColorChanges(
  startRow: number,
  endRow: number,
  text: string,
  colorRuns: ColorRun[],
): string[] {
  const relevantRuns = colorRuns.filter(
    (run) => run.endRow >= startRow && run.startRow <= endRow,
  );
  if (relevantRuns.length === 0) {
    return [`${rowLabel(startRow, endRow)}: ${text}`];
  }

  return relevantRuns.map((run, index) => {
    const segmentStart = Math.max(startRow, run.startRow);
    const segmentEnd = Math.min(
      endRow,
      index < relevantRuns.length - 1
        ? relevantRuns[index + 1].startRow - 1
        : run.endRow,
    );
    const nextRun = relevantRuns[index + 1];
    const suffix =
      nextRun && nextRun.startRow <= endRow
        ? `. Change yarn before Row ${nextRun.startRow} to ${describeColor(nextRun.color)}.`
        : "";
    return `${rowLabel(segmentStart, segmentEnd)}: ${text}${suffix}`;
  });
}

function effectiveSphereDimensions(
  mesh: StoredMesh | undefined,
  part: DesignPart,
): { x: number; y: number; z: number; horizontalRadius: number } {
  const fromMesh = mesh ? halfExtentsFromPoints(mesh.points) : null;
  if (fromMesh) {
    return {
      ...fromMesh,
      horizontalRadius: (fromMesh.x + fromMesh.z) / 2,
    };
  }

  const baseRadius = getMeshDimensionEntry(part.meshId).connectivityRadius;
  const scale = scaleVector(part.scale);
  const x = baseRadius * scale.x;
  const y = baseRadius * scale.y;
  const z = baseRadius * scale.z;
  return {
    x,
    y,
    z,
    horizontalRadius: (x + z) / 2,
  };
}

function meshForSlot(
  meshes: StoredMesh[],
  slotId: string,
): StoredMesh | undefined {
  return meshes.find((m) => m.slotId === slotId);
}

function partSectionTitle(part: DesignPart): string {
  return `${slotLabel(part.slotId)} — ${meshLabel(part.meshId)}`;
}

function templateSphere(
  dims: { x: number; y: number; z: number; horizontalRadius: number },
  increaseRows: number,
  regularRows: number,
  maxSt: number,
  color: string,
  colorRuns: ColorRun[],
  start: { type: "magic-ring" } | { type: "chain-oval"; chainCount: number },
): string {
  const decreaseRows = increaseRows;
  const widestRowCount = 6 + (increaseRows - 1) * 6;

  function increase(numIncRows: number): string[] {
    let lines: string[] = [];

    for (let i = 0; i < numIncRows; i++) {
      lines.push(`(${i > 0 ? `${i} sc,` : ""} inc) * 6 [${(i + 2) * 6}]`);
    }

    return lines;
  }

  function decrease(numDecRows: number): string[] {
    let lines: string[] = [];

    for (let i = numDecRows - 1; i > 0; i--) {
      lines.push(`(${i} sc, dec) * 6 [${(i + 1) * 6}]`);
    }

    return lines;
  }

  const lines: string[] = [
    `Suggested yarn color: ${describeColor(colorRuns[0]?.color ?? color)}`,
  ];

  if (start.type === "magic-ring") {
    lines.push(
      ...lineWithInlineColorChanges(1, 1, "6 sc in magic ring [6]", colorRuns),
    );
  } else {
    lines.push(
      ...lineWithInlineColorChanges(
        1,
        1,
        `Ch ${start.chainCount}; work around both sides of the chain to form an oval start.`,
        colorRuns,
      ),
    );
  }

  lines.push(
    ...increase(increaseRows - 1).flatMap((line, i) =>
      lineWithInlineColorChanges(i + 2, i + 2, line, colorRuns),
    ),
  );
  lines.push(
    ...lineWithInlineColorChanges(
      increaseRows + 1,
      increaseRows + regularRows + 1,
      `sc around [${widestRowCount}]`,
      colorRuns,
    ),
  );
  lines.push(
    ...decrease(decreaseRows - 1).flatMap((line, i) =>
      lineWithInlineColorChanges(
        increaseRows + regularRows + 2 + i,
        increaseRows + regularRows + 2 + i,
        line,
        colorRuns,
      ),
    ),
  );
  lines.push("Stuff firmly.");
  lines.push(
    ...lineWithInlineColorChanges(
      increaseRows + regularRows + decreaseRows,
      increaseRows + regularRows + decreaseRows,
      "(dec) * 6 [6]",
      colorRuns,
    ),
  );
  lines.push("Weave closed and fasten off, leaving a long tail for sewing.");

  return lines.join("\n");
}

function templateCylinder(
  tubeR: number,
  height: number,
  circ: number,
  hRows: number,
  color: string,
  colorRuns: ColorRun[],
): string {
  const approx = Math.round(circ * hRows * 1.05);

  // round circ to the nearest multiple of 6
  /**
   * start with magic ring of 6 stitches
   * increase until you reach the target circumference
   * for one row, sc around [circ] stitches
   * repeat for [hRows - 1] rows
   * stuff
   * in the back loop, start decreasing
   * fasten off
   */
  const circumference = Math.max(1, Math.round(circ / 6) * 6);

  function increase(circumference: number): string[] {
    let lines: string[] = [];

    for (let i = 0; i < circumference / 6 - 1; i++) {
      lines.push(`(${i > 0 ? `${i} sc, ` : ""}inc) * 6 [${(i + 2) * 6}]`);
    }

    return lines;
  }

  function decrease(circumference: number): string[] {
    let lines: string[] = [];

    for (let i = circumference; i > 12; i -= 6) {
      const st = (i - 12) / 6;
      lines.push(`(${st > 0 ? `${st} sc, ` : ""}dec) * 6 [${i - 6}]`);
    }

    return lines;
  }

  const lines: string[] = [
    `Suggested yarn color: ${describeColor(colorRuns[0]?.color ?? color)}`,
    ...lineWithInlineColorChanges(1, 1, "6 sc in magic ring [6]", colorRuns),
    ...increase(circumference).flatMap((line, i) =>
      lineWithInlineColorChanges(i + 2, i + 2, line, colorRuns),
    ),
    ...lineWithInlineColorChanges(
      circumference / 6 + 1,
      circumference / 6 + 1,
      `in blo, sc around [${circumference}]`,
      colorRuns,
    ),
    ...lineWithInlineColorChanges(
      circumference / 6 + 2,
      circumference / 6 + hRows,
      `in blo, sc around [${circumference}]`,
      colorRuns,
    ),
    ...lineWithInlineColorChanges(
      circumference / 6 + hRows + 1,
      circumference / 6 + hRows + 1,
      `in blo, ${decrease(circumference)[0]}`,
      colorRuns,
    ),
    ...decrease(circumference - 6).flatMap((line, i) =>
      lineWithInlineColorChanges(
        circumference / 6 + hRows + 2 + i,
        circumference / 6 + hRows + 2 + i,
        line,
        colorRuns,
      ),
    ),
    "Stuff firmly.",
    ...lineWithInlineColorChanges(
      circumference / 6 + hRows + 2 + Math.floor((circumference - 12) / 6) - 1,
      circumference / 6 + hRows + 2 + Math.floor((circumference - 12) / 6) - 1,
      "(dec) * 6 [6]",
      colorRuns,
    ),
    "Weave closed and fasten off, leaving a long tail for sewing.",
  ];

  return lines.join("\n");
}

function templateCone(
  rBase: number,
  height: number,
  stBase: number,
  rows: number,
  color: string,
): string {
  const stTip = clampStitches(stBase * 0.15);
  const approx = Math.round(((stBase + stTip) / 2) * rows);
  return [
    `Suggested yarn color: ${color}`,
    "",
    "Cone shape: start at the wide base and decrease toward the tip.",
    "",
    `Base radius ≈ ${rBase.toFixed(3)}; height ≈ ${height.toFixed(3)}.`,
    `Base round ~${stBase} sc; tip target ~${stTip} sc; ~${rows} shaping rows.`,
    "",
    "Suggested steps:",
    `1. Begin with a round of ~${stBase} sc (magic ring + increases, or chain ring).`,
    "2. Each row, decrease evenly while maintaining a smooth cone until a small opening remains at the tip.",
    "3. Stuff lightly if needed; close the tip or leave a yarn tail for sewing.",
    "",
    `Approximate total stitches (very rough): ~${approx}.`,
  ].join("\n");
}

function templateTeardrop(
  tubeR: number,
  height: number,
  circ: number,
  hRows: number,
  color: string,
  colorRuns: ColorRun[],
): string {
  const circumference = Math.max(1, Math.round(circ / 6) * 6);

  function increase(circumference: number): string[] {
    let lines: string[] = [];

    for (let i = 0; i < circumference / 6 - 1; i++) {
      lines.push(`(${i > 0 ? `${i} sc, ` : ""}inc) * 6 [${(i + 2) * 6}]`);
    }

    return lines;
  }

  function decrease(circumference: number): string[] {
    let lines: string[] = [];

    for (let i = circumference; i > 12; i -= 6) {
      const st = (i - 12) / 6;
      lines.push(`(${st > 0 ? `${st} sc, ` : ""}dec) * 6 [${i - 6}]`);
    }

    return lines;
  }

  const lines: string[] = [
    `Suggested yarn color: ${describeColor(colorRuns[0]?.color ?? color)}`,
    ...lineWithInlineColorChanges(1, 1, "6 sc in magic ring [6]", colorRuns),
    ...increase(circumference).flatMap((line, i) =>
      lineWithInlineColorChanges(i + 2, i + 2, line, colorRuns),
    ),
    ...lineWithInlineColorChanges(
      circumference / 6 + 1,
      circumference / 6 + 1,
      `sc around [${circumference}]`,
      colorRuns,
    ),
    ...lineWithInlineColorChanges(
      circumference / 6 + 2,
      circumference / 6 + hRows,
      `sc around [${circumference}]`,
      colorRuns,
    ),
    ...lineWithInlineColorChanges(
      circumference / 6 + hRows + 1,
      circumference / 6 + hRows + 1,
      `${decrease(circumference)[0]}`,
      colorRuns,
    ),
    ...decrease(circumference - 6).flatMap((line, i) =>
      lineWithInlineColorChanges(
        circumference / 6 + hRows + 2 + i,
        circumference / 6 + hRows + 2 + i,
        line,
        colorRuns,
      ),
    ),
    "Stuff to liking, recommended lightly for a softer curve.",
    ...lineWithInlineColorChanges(
      circumference / 6 + hRows + 2 + Math.floor((circumference - 12) / 6) - 1,
      circumference / 6 + hRows + 2 + Math.floor((circumference - 12) / 6) - 1,
      "(dec) * 6 [6]",
      colorRuns,
    ),
    "Leave open and fasten off, leaving a long tail for sewing.",
  ];

  return lines.join("\n");
}

function partPatternBody(
  part: DesignPart,
  mesh: StoredMesh | undefined,
): string {
  const scale = scaleVector(part.scale);
  const dim = getMeshDimensionEntry(part.meshId);
  const family = shapeFamily(part.meshId);
  const color = colorHint(mesh, part);

  if (family === "cylinder") {
    const tubeR =
      (dim.tubeRadius ?? dim.connectivityRadius) *
      averageHorizontalScaleFactor(scale);
    const height = (dim.height ?? dim.connectivityRadius * 2) * scale.y;
    const circ = stitchesForCircumference(tubeR);
    const hRows = rowsForLength(height);
    const circumference = Math.max(1, Math.round(circ / 6) * 6);
    const totalRows =
      1 + (circumference / 6 - 1) + hRows + (circumference / 6 - 1) + 1;
    const colorRuns = buildColorRuns(part, color, totalRows);
    return templateCylinder(tubeR, height, circ, hRows, color, colorRuns);
  }

  if (family === "cone") {
    const rBase =
      (dim.tubeRadius ?? dim.connectivityRadius * 0.35) *
      averageHorizontalScaleFactor(scale);
    const height = (dim.height ?? dim.connectivityRadius * 1.2) * scale.y;
    const stBase = stitchesForCircumference(rBase);
    const rows = rowsForLength(height);
    return templateCone(rBase, height, stBase, rows, color);
  }

  if (family === "teardrop") {
    const tubeR =
      (dim.tubeRadius ?? dim.connectivityRadius) *
      averageHorizontalScaleFactor(scale);
    const height = (dim.height ?? dim.connectivityRadius * 2) * scale.y;
    const circ = stitchesForCircumference(tubeR);
    const hRows = rowsForLength(height);
    const circumference = Math.max(1, Math.round(circ / 6) * 6);
    const totalRows =
      1 + (circumference / 6 - 1) + hRows + (circumference / 6 - 1) + 1;
    const colorRuns = buildColorRuns(part, color, totalRows);
    return templateTeardrop(tubeR, height, circ, hRows, color, colorRuns);
  }

  const dims = effectiveSphereDimensions(mesh, part);
  const largerHorizontalScale = Math.max(scale.x, scale.z);
  const smallerHorizontalScale = Math.min(scale.x, scale.z);
  const increaseRows = Math.max(
    1,
    Math.round(7 * Math.sqrt(smallerHorizontalScale) - 1),
  );
  const regularRows = Math.max(1, Math.round((increaseRows + 1) * scale.y));
  const maxSt = stitchesForCircumference(dims.horizontalRadius);
  const isRoundHorizontal = Math.abs(scale.x - scale.z) < 0.001;
  const start = isRoundHorizontal
    ? { type: "magic-ring" as const }
    : {
        type: "chain-oval" as const,
        chainCount: Math.max(6, Math.round(6 * largerHorizontalScale)),
      };
  const totalRows = increaseRows + regularRows + increaseRows;
  const colorRuns = buildColorRuns(part, color, totalRows);
  return templateSphere(
    dims,
    increaseRows,
    regularRows,
    maxSt,
    color,
    colorRuns,
    start,
  );
}

export function buildAssemblySection(parts: DesignPart[]): string {
  if (parts.length === 0) return "";
  if (parts.length === 1) {
    return [
      "SEWING / ASSEMBLY",
      "=================",
      "",
      "Only one part in this design — no joins needed.",
      "",
    ].join("\n");
  }

  const n = parts.length;
  const centers = parts.map(partWorldCenter);
  const radii = parts.map((p) => getConnectivityRadius(p.meshId, p.scale));

  const adj: boolean[][] = parts.map(() => parts.map(() => false));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (dist3(centers[i], centers[j]) < radii[i] + radii[j]) {
        adj[i][j] = true;
        adj[j][i] = true;
      }
    }
  }

  const root = parts.findIndex((p) => p.slotId === "body");
  const rootIdx = root >= 0 ? root : 0;

  const visited = new Array(n).fill(false);
  const queue: number[] = [rootIdx];
  visited[rootIdx] = true;
  const treeEdges: [number, number][] = [];

  while (queue.length > 0) {
    const u = queue.shift()!;
    for (let v = 0; v < n; v++) {
      if (adj[u][v] && !visited[v]) {
        visited[v] = true;
        treeEdges.push([u, v]);
        queue.push(v);
      }
    }
  }

  const isolated = parts
    .map((p, i) => (visited[i] ? null : partSectionTitle(p)))
    .filter((x): x is string => x != null);

  const lines: string[] = [
    "SEWING / ASSEMBLY",
    "=================",
    "",
    "Join pieces by sewing using yarn and a tapestry needle. Use a",
    "whip stitch or mattress stitch along the edges for best results.",
    "",
  ];

  if (treeEdges.length === 0) {
    lines.push(
      "No overlapping parts were detected — check spacing in the design before sewing.",
    );
    lines.push("");
  } else {
    lines.push("Suggested order (from the main body outward):");
    lines.push("");
    for (const [parent, child] of treeEdges) {
      const a = partSectionTitle(parts[parent]);
      const b = partSectionTitle(parts[child]);
      lines.push(`• Sew ${b} to ${a}.`);
    }
    lines.push("");
  }

  if (isolated.length > 0) {
    lines.push(
      "Note: these parts were not detected as touching the connected group (adjust placement or sew anyway):",
    );
    for (const label of isolated) {
      lines.push(`  – ${label}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

function header(design: Design): string {
  const title = design.name?.trim() || "Untitled design";
  return [
    "CROCHET PATTERN — ESTIMATED INSTRUCTIONS",
    "========================================",
    "",
    `Design: ${title}`,
    `Design id: ${design.id}`,
    "",
    "GAUGE ASSUMPTIONS (from your 3D model scale)",
    "-------------------------------------------",
    `Stitch width (horizontal): ${STITCH_WIDTH} (same length units as the stored mesh / scene).`,
    `Row height (vertical):     ${ROW_HEIGHT}`,
    "",
    "All stitch counts are ESTIMATES. Swatch and adjust rounds to match your yarn and hook.",
    "",
    "PARTS",
    "=====",
    "",
  ].join("\n");
}

export function compileCrochetPattern(design: Design): string {
  const meshes = design.finalizedMeshes ?? [];
  const sortedParts = [...design.parts].sort(
    (a, b) => sortKey(a.slotId) - sortKey(b.slotId),
  );

  const blocks: string[] = [header(design)];

  for (const part of sortedParts) {
    const mesh = meshForSlot(meshes, part.slotId);
    const title = partSectionTitle(part);
    blocks.push(`--- ${title} ---`);
    blocks.push("");
    blocks.push(partPatternBody(part, mesh));
    blocks.push("");
  }

  blocks.push(buildAssemblySection(design.parts));
  blocks.push("— End of sheet —");
  blocks.push("");

  return blocks.join("\n");
}

/** Safe filename stem for Content-Disposition (no path chars). */
export function patternAttachmentFilename(
  design: Pick<Design, "id" | "name">,
): string {
  const raw = design.name
    ?.trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "");
  const stem = raw && raw.length > 0 ? raw.slice(0, 60) : design.id;
  return `${stem}-crochet-pattern.txt`;
}
