import type { PlacedPart } from "./types";
import { MANNEQUIN_SLOTS } from "./presets";

/** Keep in sync with `backend/src/meshDimensions.ts` → `MESH_DIMENSIONS.connectivityRadius`. */
const MESH_RADIUS: Record<string, number> = {
  "head-sphere": 0.28,
  "head-cylinder": 0.28,
  "body-sphere": 0.44,
  "body-cylinder": 0.44,
  "body-cone": 0.45,
  "body-teardrop": 0.44,
  "limb-sphere": 0.15,
  "limb-cylinder": 0.30,
  "limb-teardrop": 0.30,
  "ear-sphere": 0.10,
  "ear-cylinder": 0.14,
  "ear-cone": 0.20,
  "ear-circle": 0.14,
  "ear-teardrop": 0.20,
  "tail": 0.20,
  "sphere": 0.24,
  "cylinder": 0.28,
  "cone": 0.28,
  "custom-teardrop": 0.40,
  "body-custom-teardrop": 0.44,
};

function getRadius(part: PlacedPart): number {
  const base = MESH_RADIUS[part.meshId] ?? 0.30;
  return base * Math.max(...part.scale);
}

function getWorldCenter(part: PlacedPart): [number, number, number] {
  const slot = MANNEQUIN_SLOTS.find((s) => s.id === part.slotId);
  const sp = slot?.position ?? [0, 0, 0];
  return [sp[0] + part.position[0], sp[1] + part.position[1], sp[2] + part.position[2]];
}

function dist(a: [number, number, number], b: [number, number, number]): number {
  return Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2);
}

/** Returns slot labels of parts not reachable from the first part. Empty = all connected. */
export function findDisconnectedParts(parts: PlacedPart[]): string[] {
  if (parts.length <= 1) return [];

  const centers = parts.map(getWorldCenter);
  const radii = parts.map(getRadius);

  const adj: boolean[][] = parts.map(() => parts.map(() => false));
  for (let i = 0; i < parts.length; i++) {
    for (let j = i + 1; j < parts.length; j++) {
      if (dist(centers[i], centers[j]) < radii[i] + radii[j]) {
        adj[i][j] = true;
        adj[j][i] = true;
      }
    }
  }

  const visited = new Array(parts.length).fill(false);
  const queue = [0];
  visited[0] = true;
  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (let j = 0; j < parts.length; j++) {
      if (adj[cur][j] && !visited[j]) {
        visited[j] = true;
        queue.push(j);
      }
    }
  }

  return parts
    .filter((_, i) => !visited[i])
    .map((p) => MANNEQUIN_SLOTS.find((s) => s.id === p.slotId)?.label ?? p.slotId);
}
