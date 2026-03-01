import { readFile, writeFile, mkdir, readdir } from "fs/promises";
import { join } from "path";
import type { Design } from "./types.js";

const DATA_DIR = join(process.cwd(), "data", "designs");

async function ensureDataDir(): Promise<void> {
  await mkdir(DATA_DIR, { recursive: true });
}

function designPath(id: string): string {
  return join(DATA_DIR, `${id}.json`);
}

export async function saveDesign(design: Design): Promise<Design> {
  await ensureDataDir();
  const path = designPath(design.id);
  design.updatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(design, null, 2), "utf-8");
  return design;
}

export async function getDesign(id: string): Promise<Design | null> {
  try {
    const path = designPath(id);
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as Design;
  } catch {
    return null;
  }
}

export async function listDesigns(): Promise<{ id: string; name?: string; updatedAt: string }[]> {
  await ensureDataDir();
  const files = await readdir(DATA_DIR);
  const list: { id: string; name?: string; updatedAt: string }[] = [];
  for (const f of files) {
    if (!f.endsWith(".json")) continue;
    const id = f.slice(0, -5);
    const design = await getDesign(id);
    if (design) list.push({ id: design.id, name: design.name, updatedAt: design.updatedAt });
  }
  return list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
