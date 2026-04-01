import type { Design, DesignPart, StoredMesh } from "./types.js";
import {
  ROW_HEIGHT,
  STITCH_WIDTH,
  DEFAULT_CONE_BASE_CIRCUMFERENCE,
  getConnectivityRadius,
  getMeshDimensionEntry,
  meshLabel,
  MANNEQUIN_SLOT_POSITIONS,
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
  return [sp[0] + part.position.x, sp[1] + part.position.y, sp[2] + part.position.z];
}

function dist3(a: [number, number, number], b: [number, number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

/** Bounding-sphere radius from flattened xyz points; null if insufficient data. */
export function boundingSphereRadiusFromPoints(points: number[]): number | null {
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
    const d = Math.hypot(points[i] - cx, points[i + 1] - cy, points[i + 2] - cz);
    if (d > maxD) maxD = d;
  }
  return maxD;
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

function shapeFamily(meshId: string): "sphere" | "cylinder" | "cone" | "teardrop" {
  if (meshId.includes("teardrop")) return "teardrop";
  if (meshId.includes("cone")) return "cone";
  if (meshId.includes("cylinder")) return "cylinder";
  return "sphere";
}

function colorHint(mesh: StoredMesh | undefined, part: DesignPart): string {
  const c = mesh?.colors?.[0] ?? part.color;
  return c || "(use your chosen main color)";
}

function effectiveSphereRadius(
  mesh: StoredMesh | undefined,
  part: DesignPart,
  scale: number
): number {
  const fromMesh = mesh ? boundingSphereRadiusFromPoints(mesh.points) : null;
  if (fromMesh != null && fromMesh > 0) return fromMesh;
  return getMeshDimensionEntry(part.meshId).connectivityRadius * scale;
}

function meshForSlot(meshes: StoredMesh[], slotId: string): StoredMesh | undefined {
  return meshes.find((m) => m.slotId === slotId);
}

function partSectionTitle(part: DesignPart): string {
  return `${slotLabel(part.slotId)} — ${meshLabel(part.meshId)}`;
}

function templateSphere(rows: number, maxSt: number, color: string): string {
  const circumference = Math.max(6, Math.round(maxSt / 6) * 6);
  const steps = circumference / 6 - 1; // increase rounds (and matching decrease rounds)
  const middleRows = Math.max(0, rows - 1 - steps * 2);

  const lines: string[] = [];
  lines.push(`Color: ${color}`);
  lines.push("");

  let r2 = 1;
  let circ = 6;
  lines.push(`Row ${r2}: 6 sc in magic ring [6]`);
  r2++;

  // increases
  for (let i = 0; i < steps; i++) {
    circ += 6;
    const inst = i === 0 ? `inc * 6` : `(${i} sc, inc) * 6`;
    lines.push(`Row ${r2}: ${inst} [${circ}]`);
    r2++;
  }

  // middle plain rows
  if (middleRows === 1) {
    lines.push(`Row ${r2}: sc around [${circ}]`);
    r2++;
  } else if (middleRows > 1) {
    lines.push(`Rows ${r2}-${r2 + middleRows - 1}: sc around [${circ}]`);
    r2 += middleRows;
  }

  // decreases
  for (let i = steps - 1; i >= 0; i--) {
    const inst = i === 0 ? `dec * 6` : `(${i} sc, dec) * 6`;
    if (i === steps - 1) {
      lines.push(`Row ${r2}: ${inst} [${circ - 6}]`);
      r2++;
      lines.push("Stuff firmly.");
    } else {
      circ -= 6;
      lines.push(`Row ${r2}: ${inst} [${circ}]`);
      r2++;
    }
    circ -= 6;
  }

  lines.push("Weave closed and fasten off, leaving a long tail for sewing.");
  return lines.join("\n");
}

function templateCylinder(tubeR: number, height: number, circ: number, hRows: number, color: string): string {
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

    for (let i = 0; i < (circumference / 6) - 1; i++) {
      lines.push(`(${ i > 0 ? `${i} sc,` : "" }inc) * 6 [${(i + 2) * 6}]`);
    }

    return lines;
  }

  function decrease(circumference: number): string[] {
    let lines: string[] = [];

    for (let i = circumference; i > 1; i -= 6) {
      const st = (i - 12) / 6;
      lines.push(`(${ st > 0 ? `${st} sc,` : "" }dec) * 6 [${i - 6}]`);
    }

    return lines;
  }

  const arrayRange = (start: number, stop: number, step: number): number[] =>
    Array.from(
    { length: (stop - start) / step + 1 },
    (value, index) => start + index * step
    );
  
  let template = [
    `Color: ${color}`,
    "",
    "Row 1: 6 sc in magic ring [6]",
    ...increase(circumference).map((line, i) => `Row ${i + 2}: ${line}`),
    `Row ${circumference / 6 + 1}: in blo, sc around [${circumference}]`,
    ...arrayRange(circumference / 6 + 2, circumference / 6 + hRows, 1).map((row) => `Row ${row}: sc around [${circumference}]`),
    `Row ${circumference / 6 + hRows + 1}: in blo, ${decrease(circumference)[0]}`,
    'stuff firmly',
    ...decrease(circumference-6).map((line, i) => `Row ${circumference / 6 + i + hRows + 1}: ${line}`),
    'fasten off',
  ].join("\n");

  return template;
}

function templateCone(
  stBase: number,
  rows: number,
  color: string
): string {
  const circumference = Math.max(6, Math.round(stBase / 6) * 6);
  const steps = Math.max(1, circumference / 6 - 1);

  const coreRows = 1 + steps;
  const totalRows = Math.max(rows, coreRows);


  const totalPlainRows = totalRows - 1 - steps;
  const plainsFirst = Math.min(1, totalPlainRows);
  const plainsRemaining = totalPlainRows - plainsFirst;
  function plainsBeforeInc(i: number): number {
    if (i === 0) return plainsFirst;
    const idx = i - 1; // index into the remaining gaps (steps-1 gaps)
    const gaps = steps - 1;
    if (gaps === 0) return 0;
    const base = Math.floor(plainsRemaining / gaps);
    const extra = plainsRemaining % gaps;
    return base + (idx < extra ? 1 : 0);
  }

  let currentCirc = 6;
  let r = 2;
  const lines: string[] = [];

  lines.push(`Color: ${color}`);
  lines.push("");
  lines.push(`Row 1: 6 sc in magic ring [6]`);

  for (let i = 0; i < steps; i++) {
    const plains = plainsBeforeInc(i);
    for (let j = 0; j < plains; j++) {
      lines.push(`Row ${r}: sc around [${currentCirc}]`);
      r++;
    }

    currentCirc += 6;
    const incInstruction = i === 0 ? `inc * 6` : `(${i} sc, inc) * 6`;
    lines.push(`Row ${r}: ${incInstruction} [${currentCirc}]`);
    r++;
  }

  lines.push("");
  lines.push("Leave the base open for sewing unless you want to keep building from the wide end.");
  lines.push("Fasten off, leaving a long tail for sewing if this is a separate part.");
  lines.push("");

  const approx = Math.round(((6 + circumference) / 2) * totalRows * 0.9);
  lines.push(`Approximate total stitches (very rough): ~${approx}.`);

  return lines.join("\n");
}

function templateTeardrop(
  rMax: number,
  height: number,
  stMax: number,
  rows: number,
  color: string
): string {
  const stMin = clampStitches(stMax * 0.2);
  const approx = Math.round(((stMax + stMin) / 2) * rows);
  return [
    `Suggested yarn color: ${color}`,
    "",
    "Teardrop / rounded taper: wide at one end, narrow at the other.",
    "",
    `Max radius ≈ ${rMax.toFixed(3)}; length ≈ ${height.toFixed(3)}.`,
    `Largest round ~${stMax} sc; narrow end ~${stMin} sc; ~${rows} rows along the length.`,
    "",
    "Suggested steps:",
    "1. Start at the narrow or wide end (your preference); work in spiral rounds.",
    "2. Increase or decrease evenly row-to-row so the circumference follows the teardrop profile.",
    "3. Stuff before closing the final opening.",
    "",
    `Approximate total stitches (very rough): ~${approx}.`,
  ].join("\n");
}

function partPatternBody(part: DesignPart, mesh: StoredMesh | undefined): string {
  const scale = part.scale;
  const dim = getMeshDimensionEntry(part.meshId);
  const family = shapeFamily(part.meshId);
  const color = colorHint(mesh, part);

  if (family === "cylinder") {
    const tubeR = (dim.tubeRadius ?? dim.connectivityRadius) * scale;
    const height = (dim.height ?? dim.connectivityRadius * 2) * scale;
    const circ = stitchesForCircumference(tubeR);
    const hRows = rowsForLength(height);
    return templateCylinder(tubeR, height, circ, hRows, color);
  }

  if (family === "cone") {
    const rBase = (dim.tubeRadius ?? dim.connectivityRadius * 0.35) * scale;
    const height = (dim.height ?? dim.connectivityRadius * 1.2) * scale;
    const stBase = stitchesForCircumference(rBase);
    const rows = rowsForLength(height);
    return templateCone(stBase, rows, color);
  }

  if (family === "teardrop") {
    const rMax = effectiveSphereRadius(mesh, part, scale);
    const heightRaw = dim.height ?? dim.connectivityRadius * 2;
    const height = heightRaw * scale;
    const stMax = stitchesForCircumference(rMax);
    const rows = rowsForLength(height);
    return templateTeardrop(rMax, height, stMax, rows, color);
  }

  const r = effectiveSphereRadius(mesh, part, scale);
  const rows = Math.max(1, rowsForLength(2 * r));
  const maxSt = stitchesForCircumference(r);
  return templateSphere(rows, maxSt, color);
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
    "Join pieces by sewing unless you prefer another strong join. Use yarn and a tapestry needle;",
    "whip stitch or mattress stitch along the mating edges. Match right sides out unless you prefer",
    "seaming inside-out then turning (not typical for amigurumi).",
    "",
  ];

  if (treeEdges.length === 0) {
    lines.push("No overlapping parts were detected — check spacing in the design before sewing.");
    lines.push("");
  } else {
    lines.push("Suggested order (from the main body outward):");
    lines.push("");
    for (const [parent, child] of treeEdges) {
      const a = partSectionTitle(parts[parent]);
      const b = partSectionTitle(parts[child]);
      lines.push(
        `• Sew "${b}" to "${a}" along the joining edge, easing the openings so the limbs/head/ears sit naturally.`
      );
    }
    lines.push("");
  }

  if (isolated.length > 0) {
    lines.push("Note: these parts were not detected as touching the connected group (adjust placement or sew anyway):");
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
  const sortedParts = [...design.parts].sort((a, b) => sortKey(a.slotId) - sortKey(b.slotId));

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
export function patternAttachmentFilename(design: Pick<Design, "id" | "name">): string {
  const raw = design.name?.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
  const stem = raw && raw.length > 0 ? raw.slice(0, 60) : design.id;
  return `${stem}-crochet-pattern.txt`;
}
