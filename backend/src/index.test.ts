import supertest from "supertest";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

describe("sketch inference API", () => {
  const sketchesDir = resolve(process.cwd(), "data", "sketches");
  const meshesDir = resolve(process.cwd(), "data", "meshes");
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("returns 400 when sketchPath is missing", async () => {
    const { app } = await import("./index.js");
    const res = await supertest(app).post("/api/sketches/infer-parts").send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toContain("sketchPath");
  });

  it("returns inferred parts payload", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          placedParts: [
            {
              meshId: "body-teardrop",
              slotId: "body",
              position: { x: 0, y: 0, z: 0 },
              scale: { x: 1, y: 1, z: 1 },
              rotation: { x: 0, y: 0, z: 0 },
              color: "#c4a574",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );

    const { app } = await import("./index.js");
    const res = await supertest(app)
      .post("/api/sketches/infer-parts")
      .send({ sketchPath: "IMG_2345.JPG" });

    expect(res.status).toBe(200);
    expect(res.body.placedParts).toHaveLength(1);
    expect(res.body.placedParts[0].slotId).toBe("body");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uploads and lists sketches", async () => {
    await mkdir(sketchesDir, { recursive: true });
    const { app } = await import("./index.js");
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xdb]);

    const uploadRes = await supertest(app)
      .post("/api/sketches/upload")
      .attach("file", image, "test-upload.jpg");
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.filename).toBe("test-upload.jpg");

    const listRes = await supertest(app).get("/api/sketches");
    expect(listRes.status).toBe(200);
    expect(listRes.body.sketches).toContain("test-upload.jpg");

    await rm(resolve(sketchesDir, "test-upload.jpg"), { force: true });
  });

  it("uploads, lists, and serves mesh files", async () => {
    await mkdir(meshesDir, { recursive: true });
    const { app } = await import("./index.js");
    const glb = Buffer.from("glTF", "utf-8");

    const uploadRes = await supertest(app)
      .post("/api/meshes/upload")
      .attach("file", glb, "sample.glb");
    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.filename).toBe("sample.glb");

    const listRes = await supertest(app).get("/api/meshes");
    expect(listRes.status).toBe(200);
    expect(listRes.body.meshes).toContain("sample.glb");

    const fileRes = await supertest(app).get("/api/meshes/sample.glb");
    expect(fileRes.status).toBe(200);
    expect(fileRes.body).toBeTruthy();

    await rm(resolve(meshesDir, "sample.glb"), { force: true });
  });

  it("rejects non-glb mesh uploads", async () => {
    const { app } = await import("./index.js");
    const text = Buffer.from("abc", "utf-8");
    const res = await supertest(app)
      .post("/api/meshes/upload")
      .attach("file", text, "not-mesh.txt");
    expect(res.status).toBe(400);
  });
});
