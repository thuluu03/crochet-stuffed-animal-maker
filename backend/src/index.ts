import express from "express";
import cors from "cors";
import { v4 as uuidv4 } from "uuid";
import { saveDesign, getDesign, listDesigns } from "./storage.js";
import type { Design, DesignPart, StoredMesh } from "./types.js";
import { compileCrochetPattern, patternAttachmentFilename } from "./crochetPattern.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

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

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => {
  console.log(`Backend running at http://localhost:${PORT}`);
});
