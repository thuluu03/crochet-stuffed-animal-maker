import type { Design, DesignPart, StoredMesh } from "./types.js";
import {
  ROW_HEIGHT,
  STITCH_WIDTH,
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

function templateSphere(r: number, rows: number, maxSt: number, color: string): string {
  const approx = Math.round(rows * ((6 + maxSt) / 2) * 0.85);
  return [
    `Suggested yarn color: ${color}`,
    "",
    "Worked in the round (amigurumi style). All stitches are single crochet (sc) unless noted.",
    "",
    `Estimated size: characteristic radius r ≈ ${r.toFixed(3)} (same units as the design).`,
    `Target largest round: ~${maxSt} sc in circumference (from 2πr / stitch width, stitch width ≈ ${STITCH_WIDTH}).`,
    `Approximate shaping rows for a sphere: ${rows} (from 2r / row height, row height ≈ ${ROW_HEIGHT}).`,
    "",
    "Suggested shaping (adjust to your gauge):",
    "1. Magic ring or ch-2 ring: Rnd 1 — 6 sc in ring. (6)",
    `2. Increase evenly each round until you reach ~${maxSt} sts (distribute increases so the piece stays roughly spherical).`,
    "3. Work even for a short section at the widest part if you want a rounder belly/head.",
    "4. Decrease evenly, mirroring the increase rounds, until the opening is small; stuff firmly before closing.",
    "",
    `Approximate total stitches (very rough): ~${approx}.`,
  ].join("\n");
}

function templateCylinder(tubeR: number, height: number, circ: number, hRows: number, color: string): string {
  const approx = Math.round(circ * hRows * 1.05);
  return [
    `Suggested yarn color: ${color}`,
    "",
    "Worked in the round in a tube (spiral or joined rounds).",
    "",
    `Tube radius r ≈ ${tubeR.toFixed(3)}; height ≈ ${height.toFixed(3)}.`,
    `Target circumference: ~${circ} sc (2πr / stitch width, stitch width ≈ ${STITCH_WIDTH}).`,
    `Straight section rows: ~${hRows} (height / row height, row height ≈ ${ROW_HEIGHT}).`,
    "",
    "Suggested steps:",
    "1. Start with a flat circle or magic ring; increase each round until the round matches the target circumference.",
    `2. Work even (no inc/dec) for the straight tube for ~${hRows} rows.`,
    "3. Close one end before stuffing if this piece should be sealed; leave the attaching end open for sewing to the body.",
    "",
    `Approximate total stitches (very rough): ~${approx}.`,
  ].join("\n");
}

function templateCone(
  rBase: number,
  height: number,
  stBase: number,
  rows: number,
  color: string
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
    return templateCone(rBase, height, stBase, rows, color);
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
  return templateSphere(r, rows, maxSt, color);
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
