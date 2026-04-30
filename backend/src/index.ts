import express from "express";
import cors from "cors";
import multer from "multer";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { v4 as uuidv4 } from "uuid";
import { saveDesign, getDesign, listDesigns } from "./storage.js";
import type { Design, DesignPart, SketchInferenceRequest, StoredMesh } from "./types.js";
import { compileCrochetPattern, patternAttachmentFilename } from "./crochetPattern.js";

export const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const SKETCHES_DIR = resolve(process.cwd(), "data", "sketches");
const MESHES_DIR = resolve(process.cwd(), "data", "meshes");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

async function ensureAssetDirs(): Promise<void> {
  await mkdir(SKETCHES_DIR, { recursive: true });
  await mkdir(MESHES_DIR, { recursive: true });
}

function sanitizeFilename(original: string): string {
  const base = basename(original);
  const cleaned = base.replace(/[^\w.-]/g, "_");
  if (!cleaned) return `upload-${Date.now()}`;
  return cleaned;
}

function assertImageName(filename: string): boolean {
  return /\.(png|jpe?g|webp|bmp)$/i.test(filename);
}

function assertMeshName(filename: string): boolean {
  return /\.glb$/i.test(filename);
}

async function runUpload(req: express.Request, res: express.Response): Promise<void> {
  await new Promise<void>((resolveUpload, rejectUpload) => {
    (upload.single("file") as any)(req as any, res as any, (err: unknown) => {
      if (err) rejectUpload(err);
      else resolveUpload();
    });
  });
}

const SKETCH_SERVICE_URL = process.env.SKETCH_SERVICE_URL ?? "http://127.0.0.1:8003";

async function inferPartsViaPythonService(sketchPath: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${SKETCH_SERVICE_URL}/infer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sketchPath }),
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.error ?? `Python service HTTP ${response.status}`);
    }
    const json = (await response.json()) as { placedParts?: unknown[] };
    return json.placedParts ?? [];
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Sketch inference service timed out");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Create or update a design. If body.id is set and exists, update; else create. */
app.post("/api/designs", async (req, res) => {
  try {
    const body = req.body as {
      id?: string;
      name?: string;
      parts: DesignPart[];
      finalizedMeshes: StoredMesh[];
    };
    if (!body.parts || !Array.isArray(body.parts)) {
      return res.status(400).json({ error: "parts array required" });
    }
    const now = new Date().toISOString();
    let design: Design;
    if (body.id) {
      const existing = await getDesign(body.id);
      if (existing) {
        existing.name = body.name ?? existing.name;
        existing.parts = body.parts;
        existing.finalizedMeshes = body.finalizedMeshes ?? existing.finalizedMeshes;
        existing.updatedAt = now;
        design = existing;
      } else {
        design = {
          id: body.id,
          name: body.name,
          parts: body.parts,
          finalizedMeshes: body.finalizedMeshes ?? [],
          createdAt: now,
          updatedAt: now,
        };
      }
    } else {
      design = {
        id: uuidv4(),
        name: body.name,
        parts: body.parts,
        finalizedMeshes: body.finalizedMeshes ?? [],
        createdAt: now,
        updatedAt: now,
      };
    }
    await saveDesign(design);
    return res.json(design);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to save design" });
  }
});

app.get("/api/designs", async (_req, res) => {
  try {
    const list = await listDesigns();
    return res.json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to list designs" });
  }
});

app.get("/api/designs/:id/pattern", async (req, res) => {
  try {
    const design = await getDesign(req.params.id);
    if (!design) return res.status(404).json({ error: "Design not found" });
    const text = compileCrochetPattern(design);
    const filename = patternAttachmentFilename(design);
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    return res.send(text);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to generate pattern" });
  }
});

app.get("/api/designs/:id", async (req, res) => {
  try {
    const design = await getDesign(req.params.id);
    if (!design) return res.status(404).json({ error: "Design not found" });
    return res.json(design);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to get design" });
  }
});

app.get("/api/sketches", async (_req, res) => {
  try {
    await ensureAssetDirs();
    const entries = await readdir(SKETCHES_DIR, { withFileTypes: true });
    const sketches = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => assertImageName(name))
      .sort((a, b) => a.localeCompare(b));
    return res.json({ sketches });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to list sketches" });
  }
});

app.post("/api/sketches/upload", async (req, res) => {
  try {
    await runUpload(req, res);
    await ensureAssetDirs();
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file is required" });
    const filename = sanitizeFilename(file.originalname);
    if (!assertImageName(filename)) {
      return res.status(400).json({ error: "Only image files are allowed" });
    }
    const path = resolve(SKETCHES_DIR, filename);
    await writeFile(path, file.buffer);
    return res.status(201).json({ filename });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to upload sketch file" });
  }
});

app.get("/api/meshes", async (_req, res) => {
  try {
    await ensureAssetDirs();
    const entries = await readdir(MESHES_DIR, { withFileTypes: true });
    const meshes = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => assertMeshName(name))
      .sort((a, b) => a.localeCompare(b));
    return res.json({ meshes });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to list meshes" });
  }
});

app.post("/api/meshes/upload", async (req, res) => {
  try {
    await runUpload(req, res);
    await ensureAssetDirs();
    const file = req.file;
    if (!file) return res.status(400).json({ error: "file is required" });
    const filename = sanitizeFilename(file.originalname);
    if (!assertMeshName(filename)) {
      return res.status(400).json({ error: "Only .glb files are allowed" });
    }
    const path = resolve(MESHES_DIR, filename);
    await writeFile(path, file.buffer);
    return res.status(201).json({ filename });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to upload mesh file" });
  }
});

app.get("/api/meshes/:filename", async (req, res) => {
  try {
    await ensureAssetDirs();
    const requested = sanitizeFilename(req.params.filename);
    if (!assertMeshName(requested)) {
      return res.status(400).json({ error: "Invalid mesh filename" });
    }
    const path = resolve(MESHES_DIR, requested);
    const info = await stat(path).catch(() => null);
    if (!info || !info.isFile()) {
      return res.status(404).json({ error: "Mesh file not found" });
    }
    return res.sendFile(path);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Failed to fetch mesh file" });
  }
});

app.post("/api/sketches/infer-parts", async (req, res) => {
  try {
    const body = req.body as SketchInferenceRequest;
    if (!body?.sketchPath || typeof body.sketchPath !== "string") {
      return res.status(400).json({ error: "sketchPath is required" });
    }
    const placedParts = await inferPartsViaPythonService(body.sketchPath);
    return res.json({ placedParts });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Sketch inference failed";
    if (message.includes("required") || message.includes("inside") || message.includes("No sketch")) {
      return res.status(400).json({ error: message });
    }
    if (message.includes("not found")) {
      return res.status(404).json({ error: "Sketch file not found" });
    }
    if (message.includes("timed out")) {
      return res.status(504).json({ error: message });
    }
    return res.status(500).json({ error: "Sketch inference failed" });
  }
});

const PORT = process.env.PORT ?? 3001;
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Backend running at http://localhost:${PORT}`);
  });
}
