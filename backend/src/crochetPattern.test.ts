import { describe, it, expect } from "vitest";
import {
  boundingSphereRadiusFromPoints,
  stitchesForCircumference,
  compileCrochetPattern,
  buildAssemblySection,
  patternAttachmentFilename,
} from "./crochetPattern.js";
import { STITCH_WIDTH } from "./meshDimensions.js";
import type { Design, DesignPart } from "./types.js";

function part(p: Partial<DesignPart> & Pick<DesignPart, "meshId" | "slotId">): DesignPart {
  return {
    position: { x: 0, y: 0, z: 0 },
    scale: 1,
    rotation: { x: 0, y: 0, z: 0 },
    color: "#c4a574",
    ...p,
  };
}

describe("boundingSphereRadiusFromPoints", () => {
  it("returns null when fewer than 3 vertices", () => {
    expect(boundingSphereRadiusFromPoints([])).toBeNull();
    expect(boundingSphereRadiusFromPoints([0, 0, 0, 1, 0, 0])).toBeNull();
  });

  it("matches circumsphere of axis-aligned points on a sphere of radius 2", () => {
    const r = 2;
    const pts: number[] = [];
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push(r * Math.cos(t), 0, r * Math.sin(t));
    }
    for (let i = 0; i < steps; i++) {
      const t = (i / steps) * Math.PI * 2;
      pts.push(0, r * Math.cos(t), r * Math.sin(t));
    }
    const got = boundingSphereRadiusFromPoints(pts);
    expect(got).not.toBeNull();
    expect(got!).toBeGreaterThan(1.99);
    expect(got!).toBeLessThan(2.01);
  });
});

describe("stitchesForCircumference", () => {
  it("uses 2πr / STITCH_WIDTH with a minimum of 6", () => {
    const r = 1;
    const expected = Math.max(6, Math.round((2 * Math.PI * r) / STITCH_WIDTH));
    expect(stitchesForCircumference(r)).toBe(expected);
  });
});

describe("compileCrochetPattern", () => {
  it("includes header, part sections, and assembly", () => {
    const design: Design = {
      id: "test-id",
      name: "Tiny Bear",
      parts: [
        part({ meshId: "body-sphere", slotId: "body" }),
        part({ meshId: "head-sphere", slotId: "head" }),
      ],
      finalizedMeshes: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const text = compileCrochetPattern(design);
    expect(text).toContain("CROCHET PATTERN");
    expect(text).toContain("Tiny Bear");
    expect(text).toContain("Body — Sphere body");
    expect(text).toContain("Head — Sphere head");
    expect(text).toContain("SEWING / ASSEMBLY");
  });

  it("uses mesh vertex radius when points are present", () => {
    const design: Design = {
      id: "geom-id",
      name: "Geom",
      parts: [part({ meshId: "limb-sphere", slotId: "rightArm" })],
      finalizedMeshes: [
        {
          partInstanceId: "x",
          meshId: "limb-sphere",
          slotId: "rightArm",
          points: [
            3, 0, 0, -3, 0, 0, 0, 3, 0, 0, -3, 0, 0, 0, 3, 0, 0, -3,
          ],
          indices: [],
          colors: ["#000"],
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    const text = compileCrochetPattern(design);
    expect(text).toMatch(/r ≈ 3\.000/);
  });
});

describe("buildAssemblySection", () => {
  it("lists a sew step when head and body overlap by default layout", () => {
    const parts = [part({ meshId: "body-sphere", slotId: "body" }), part({ meshId: "head-sphere", slotId: "head" })];
    const text = buildAssemblySection(parts);
    expect(text).toContain('Sew "Head — Sphere head" to "Body — Sphere body"');
  });

  it("flags isolated parts when not touching the main group", () => {
    const parts = [
      part({ meshId: "body-sphere", slotId: "body" }),
      part({
        meshId: "ear-sphere",
        slotId: "leftEar",
        position: { x: 0, y: 20, z: 0 },
      }),
    ];
    const text = buildAssemblySection(parts);
    expect(text).toContain("not detected as touching");
    expect(text).toContain("Left Ear");
  });
});

describe("patternAttachmentFilename", () => {
  it("sanitizes design name", () => {
    expect(patternAttachmentFilename({ id: "uuid", name: "My  Bear!" })).toBe("My-Bear-crochet-pattern.txt");
  });

  it("falls back to id when name is empty", () => {
    expect(patternAttachmentFilename({ id: "abc-123", name: "   " })).toBe("abc-123-crochet-pattern.txt");
  });
});
