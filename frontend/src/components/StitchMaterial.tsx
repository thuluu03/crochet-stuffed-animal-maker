import { useMemo } from "react";
import * as THREE from "three";

const STITCH_TILE_SIZE = 128;
const STITCH_REPEAT = 6;

let cachedMaps:
  | {
      bumpMap: THREE.CanvasTexture;
      displacementMap: THREE.CanvasTexture;
      normalMap: THREE.CanvasTexture;
      normalScale: THREE.Vector2;
    }
  | null = null;

function createNormalMapFromBump(bumpCanvas: HTMLCanvasElement): THREE.CanvasTexture {
  const width = bumpCanvas.width;
  const height = bumpCanvas.height;
  const sourceCtx = bumpCanvas.getContext("2d");
  if (!sourceCtx) throw new Error("Missing bump canvas context");
  const src = sourceCtx.getImageData(0, 0, width, height);

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = width;
  normalCanvas.height = height;
  const normalCtx = normalCanvas.getContext("2d");
  if (!normalCtx) throw new Error("Missing normal canvas context");

  const out = normalCtx.createImageData(width, height);
  const strength = 3.5;

  const sample = (x: number, y: number) => {
    const ix = (x + width) % width;
    const iy = (y + height) % height;
    const i = (iy * width + ix) * 4;
    return src.data[i] / 255;
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const left = sample(x - 1, y);
      const right = sample(x + 1, y);
      const up = sample(x, y - 1);
      const down = sample(x, y + 1);

      const dx = (right - left) * strength;
      const dy = (down - up) * strength;

      const nx = -dx;
      const ny = -dy;
      const nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);

      const r = (nx * invLen * 0.5 + 0.5) * 255;
      const g = (ny * invLen * 0.5 + 0.5) * 255;
      const b = (nz * invLen * 0.5 + 0.5) * 255;

      const i = (y * width + x) * 4;
      out.data[i] = r;
      out.data[i + 1] = g;
      out.data[i + 2] = b;
      out.data[i + 3] = 255;
    }
  }

  normalCtx.putImageData(out, 0, 0);

  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.repeat.set(STITCH_REPEAT, STITCH_REPEAT);
  normalMap.anisotropy = 8;
  normalMap.needsUpdate = true;

  return normalMap;
}

function createCrochetMaps() {
  if (cachedMaps) return cachedMaps;

  const bumpCanvas = document.createElement("canvas");
  bumpCanvas.width = STITCH_TILE_SIZE;
  bumpCanvas.height = STITCH_TILE_SIZE;
  const bumpCtx = bumpCanvas.getContext("2d");
  if (!bumpCtx) {
    throw new Error("Failed to create stitch texture context");
  }

  bumpCtx.fillStyle = "#4a4a4a";
  bumpCtx.fillRect(0, 0, STITCH_TILE_SIZE, STITCH_TILE_SIZE);

  const columns = 8;
  const rows = 6;
  const stepX = STITCH_TILE_SIZE / columns;
  const stepY = STITCH_TILE_SIZE / rows;
  const stitchRadiusX = stepX * 0.42;
  const stitchRadiusY = stepY * 0.33;

  for (let row = 0; row < rows; row++) {
    const offsetX = row % 2 === 0 ? stepX * 0.5 : 0;
    for (let col = -1; col <= columns; col++) {
      const cx = col * stepX + offsetX;
      const cy = row * stepY + stepY * 0.55;

      const grad = bumpCtx.createRadialGradient(
        cx,
        cy,
        stitchRadiusY * 0.2,
        cx,
        cy,
        stitchRadiusX
      );
      grad.addColorStop(0, "#ffffff");
      grad.addColorStop(0.55, "#cfcfcf");
      grad.addColorStop(1, "#5c5c5c");
      bumpCtx.fillStyle = grad;

      bumpCtx.beginPath();
      bumpCtx.ellipse(cx, cy, stitchRadiusX, stitchRadiusY, 0, 0, Math.PI * 2);
      bumpCtx.fill();

      bumpCtx.globalCompositeOperation = "multiply";
      bumpCtx.strokeStyle = "rgba(40, 40, 40, 0.35)";
      bumpCtx.lineWidth = Math.max(1, stepX * 0.06);
      bumpCtx.beginPath();
      bumpCtx.moveTo(cx - stitchRadiusX * 0.42, cy - stitchRadiusY * 0.05);
      bumpCtx.lineTo(cx, cy + stitchRadiusY * 0.45);
      bumpCtx.lineTo(cx + stitchRadiusX * 0.42, cy - stitchRadiusY * 0.05);
      bumpCtx.stroke();
      bumpCtx.globalCompositeOperation = "source-over";
    }
  }

  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  bumpMap.wrapT = THREE.RepeatWrapping;
  bumpMap.repeat.set(STITCH_REPEAT, STITCH_REPEAT);
  bumpMap.anisotropy = 8;
  bumpMap.needsUpdate = true;

  const displacementMap = bumpMap.clone();
  displacementMap.wrapS = THREE.RepeatWrapping;
  displacementMap.wrapT = THREE.RepeatWrapping;
  displacementMap.repeat.copy(bumpMap.repeat);
  displacementMap.anisotropy = bumpMap.anisotropy;
  displacementMap.needsUpdate = true;

  const normalMap = createNormalMapFromBump(bumpCanvas);

  cachedMaps = {
    bumpMap,
    displacementMap,
    normalMap,
    normalScale: new THREE.Vector2(0.3, 0.3),
  };

  return cachedMaps;
}

type StitchMaterialProps = JSX.IntrinsicElements["meshStandardMaterial"];

export function StitchMaterial(props: StitchMaterialProps) {
  const maps = useMemo(() => createCrochetMaps(), []);

  return (
    <meshStandardMaterial
      {...props}
      bumpMap={maps.bumpMap}
      bumpScale={0.08}
      displacementMap={maps.displacementMap}
      displacementScale={0.006}
      displacementBias={-0.0015}
      normalMap={maps.normalMap}
      normalScale={maps.normalScale}
    />
  );
}
