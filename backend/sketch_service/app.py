from __future__ import annotations

import math
import os
from datetime import datetime
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="Sketch Inference Service")

SKETCHES_DIR = Path(os.getenv("SKETCHES_DIR", Path.cwd() / "data" / "sketches")).resolve()
DEBUG_DIR = Path(os.getenv("DEBUG_DIR", Path.cwd() / "debug")).resolve()
DEFAULT_COLOR = "#c4a574"
MAX_DIMENSION = 1050


class InferRequest(BaseModel):
    sketchPath: str


class Vector3(BaseModel):
    x: float
    y: float
    z: float


class PlacedPart(BaseModel):
    meshId: str
    slotId: str
    position: Vector3
    scale: Vector3
    rotation: Vector3
    color: str


class InferResponse(BaseModel):
    placedParts: list[PlacedPart]


class InferDebugResponse(BaseModel):
    placedParts: list[PlacedPart]
    debugOutputDir: str


@dataclass
class Region:
    min_x: int
    min_y: int
    max_x: int
    max_y: int
    area: float
    center_x: float
    center_y: float
    width: int
    height: int
    aspect_ratio: float
    circularity: float
    orientation: float
    class_hint: Literal["head", "body", "arm", "leg", "limb", "ear"] | None = None
    shape: Literal["sphere", "cylinder", "cone"] | None = None # FIXME: Include teardrop later


@dataclass
class RegionExtractionDebug:
    overlay_masks: np.ndarray
    detected_contours: np.ndarray
    labeled_parts: np.ndarray


def ensure_sketch_path(relative_path: str) -> Path:
    """Resolve and validate a sketch path so it stays inside the sketches directory."""
    candidate = relative_path.strip()
    if not candidate:
        raise ValueError("sketchPath is required")
    target = (SKETCHES_DIR / candidate).resolve()
    if SKETCHES_DIR not in target.parents and target != SKETCHES_DIR:
        raise ValueError("sketchPath must stay inside data/sketches")
    return target


def pca_orientation(points: np.ndarray) -> float:
    """Angle of a point set's principal axis in world (Three.js) coords.

    Two adjustments versus the raw atan2:
    - OpenCV's image-y points down while Three.js +y points up, so we negate y.
    - The eigenvector has sign ambiguity, so we fold the angle to ``(-pi/2, pi/2]``
      to represent an axis (line) rather than a directed vector.
    """
    if len(points) < 2:
        return 0.0
    mean = np.mean(points, axis=0)
    cov = np.cov((points - mean).T)
    eigvals, eigvecs = np.linalg.eig(cov)
    principal = eigvecs[:, int(np.argmax(eigvals))]
    angle = math.atan2(-principal[1], principal[0])
    if angle > math.pi / 2:
        angle -= math.pi
    elif angle <= -math.pi / 2:
        angle += math.pi
    return float(angle)


def merge_ranges(hsv: np.ndarray, ranges: list[tuple[tuple[int, int, int], tuple[int, int, int]]]) -> np.ndarray:
    """Build a single binary mask from one or more HSV inclusive ranges."""
    mask = np.zeros(hsv.shape[:2], dtype=np.uint8)
    for lower, upper in ranges:
        lower_arr = np.array(lower, dtype=np.uint8)
        upper_arr = np.array(upper, dtype=np.uint8)
        mask = cv2.bitwise_or(mask, cv2.inRange(hsv, lower_arr, upper_arr))
    return mask


def region_from_contour(contour: np.ndarray, class_hint: Literal["head", "body", "arm", "leg"]) -> Region:
    """Convert a contour into normalized geometric region metadata."""
    area = float(cv2.contourArea(contour))
    x, y, w, h = cv2.boundingRect(contour)
    perimeter = float(cv2.arcLength(contour, True))
    moments = cv2.moments(contour)
    cx = moments["m10"] / moments["m00"] if moments["m00"] else x + w / 2
    cy = moments["m01"] / moments["m00"] if moments["m00"] else y + h / 2
    points = contour.reshape(-1, 2).astype(np.float32)
    circularity = (4 * math.pi * area / (perimeter * perimeter)) if perimeter else 0.0
    return Region(
        min_x=int(x),
        min_y=int(y),
        max_x=int(x + w - 1),
        max_y=int(y + h - 1),
        area=area,
        center_x=float(cx),
        center_y=float(cy),
        width=int(w),
        height=int(h),
        aspect_ratio=float(w / max(1, h)),
        circularity=float(circularity),
        orientation=pca_orientation(points),
        class_hint=class_hint,
        shape=shape_from_contour(contour),
    )


_DIM_SCALE = 4.0
_MIN_SCALE = 0.05


def normalized_dim(px: float, image_max: int) -> float:
    """Convert a pixel size to a 3D scale value with a small floor."""
    image_max = max(1, int(image_max))
    return max(_MIN_SCALE, (float(px) / image_max) * _DIM_SCALE)


def scale_from_region(region: Region, width: int, height: int) -> Vector3:
    """3D scale matched to the region, accounting for the mesh's local axes.

    - ``sphere``: uniform scale based on the larger side (mesh is isotropic).
    - ``cone``: ``y`` follows height, ``x``/``z`` follow width (apex stays at +Y).
    - ``cylinder``: the mesh is rotated so its length lies along the rectangle's
      long axis, so ``y`` (mesh length) follows the long side and ``x``/``z``
      (radius) follow the short side. The circular caps end up at the short-side ends.
    """
    image_max = max(width, height)
    long_norm = normalized_dim(max(region.width, region.height), image_max)
    short_norm = normalized_dim(min(region.width, region.height), image_max)
    width_norm = normalized_dim(region.width, image_max)
    height_norm = normalized_dim(region.height, image_max)

    if region.shape == "sphere":
        return Vector3(x=width_norm, y=height_norm, z=min(width_norm, height_norm))
    if region.shape == "cone":
        return Vector3(x=width_norm, y=height_norm, z=width_norm)
    return Vector3(x=short_norm, y=long_norm, z=short_norm)


def part_rotation(region: Region) -> Vector3:
    """Z rotation that aligns the mesh's natural axis with the rectangle.

    - ``sphere``/``cone``: no rotation (sphere is isotropic; cone apex is at +Y).
    - ``cylinder``: rotate around Z so the mesh axis (+Y) lines up with the
      rectangle's long axis. This places the circular caps at the short-side ends.
    """
    if region.shape == "cylinder":
        return Vector3(x=0.0, y=0.0, z=region.orientation - math.pi / 2)
    return Vector3(x=0.0, y=0.0, z=0.0)


def make_part(slot_id: str, region: Region, width: int, height: int) -> PlacedPart:
    """Build a placed 3D part snapped to ``slot_id`` with shape-aware scale/rotation."""
    return PlacedPart(
        meshId=region.shape or "sphere",
        slotId=slot_id,
        position=Vector3(x=0.0, y=0.0, z=0.0),
        scale=scale_from_region(region, width, height),
        rotation=part_rotation(region),
        color=DEFAULT_COLOR,
    )


def _mirror_part(source: PlacedPart, target_slot_id: str) -> PlacedPart:
    """Mirror a part to the opposite slot, flipping the Z rotation for symmetry."""
    return PlacedPart(
        meshId=source.meshId,
        slotId=target_slot_id,
        position=Vector3(x=0.0, y=0.0, z=0.0),
        scale=source.scale,
        rotation=Vector3(x=source.rotation.x, y=source.rotation.y, z=-source.rotation.z),
        color=source.color,
    )


def add_symmetric(parts: list[PlacedPart], left_slot: str, right_slot: str, _mesh_id: str) -> None:
    """If only one side of a pair is present, mirror it onto the other side."""
    left = next((p for p in parts if p.slotId == left_slot), None)
    right = next((p for p in parts if p.slotId == right_slot), None)
    if left and not right:
        parts.append(_mirror_part(left, right_slot))
    elif right and not left:
        parts.append(_mirror_part(right, left_slot))

def shape_from_contour(contour: np.ndarray) -> Literal["sphere", "cylinder", "cone"]:
    """Approximate a contour to one of the supported shape mesh ids."""
    approx = cv2.approxPolyDP(contour, epsilon=0.02 * cv2.arcLength(contour, True), closed=True)
    if len(approx) == 3:
        return "cone"
    if len(approx) == 4:
        return "cylinder"
    return "sphere"

def extract_regions(image: np.ndarray, include_debug: bool = False) -> tuple[list[Region], RegionExtractionDebug | None]:
    """Extract color-coded part regions (red/blue/green/yellow) and optional debug frames."""
    hsv = cv2.cvtColor(image, cv2.COLOR_BGR2HSV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    height, width = image.shape[:2]
    min_area = max(40, int(width * height * 0.0005))

    specs: list[
        tuple[
            Literal["head", "body", "arm", "leg"],
            list[tuple[tuple[int, int, int], tuple[int, int, int]]],
            tuple[int, int, int],
        ]
    ] = [
        ("head", [((0, 80, 50), (10, 255, 255)), ((170, 80, 50), (179, 255, 255))], (0, 0, 255)),
        ("body", [((100, 80, 50), (130, 255, 255))], (255, 0, 0)),
        ("arm", [((40, 60, 40), (85, 255, 255))], (0, 255, 0)),
        ("leg", [((20, 80, 80), (35, 255, 255))], (0, 255, 255)),
    ]

    overlay_masks = image.copy()
    contour_canvas = image.copy()
    labeled_canvas = image.copy()
    regions: list[Region] = []

    for class_hint, ranges, color_bgr in specs:
        raw_mask = merge_ranges(hsv, ranges)
        opened = cv2.morphologyEx(raw_mask, cv2.MORPH_OPEN, kernel)
        closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)
        overlay_masks[closed > 0] = (
            overlay_masks[closed > 0] * 0.35 + np.array(color_bgr, dtype=np.float32) * 0.65
        ).astype(np.uint8)

        contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        cv2.drawContours(contour_canvas, contours, -1, color_bgr, 2)

        for contour in contours:
            area = float(cv2.contourArea(contour))
            if area < min_area:
                continue
            region = region_from_contour(contour, class_hint)
            regions.append(region)
            cv2.rectangle(
                labeled_canvas,
                (region.min_x, region.min_y),
                (region.max_x, region.max_y),
                color_bgr,
                2,
            )
            cv2.putText(
                labeled_canvas,
                class_hint,
                (region.min_x, max(18, region.min_y - 6)),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.55,
                color_bgr,
                2,
                cv2.LINE_AA,
            )

    regions.sort(key=lambda r: r.area, reverse=True)
    debug = (
        RegionExtractionDebug(
            overlay_masks=overlay_masks,
            detected_contours=contour_canvas,
            labeled_parts=labeled_canvas,
        )
        if include_debug
        else None
    )
    return regions, debug

_PAIRED_SLOTS: tuple[tuple[str, str, str], ...] = (
    ("arm", "leftArm", "rightArm"),
    ("leg", "leftLeg", "rightLeg"),
    ("ear", "leftEar", "rightEar"),
)


def map_regions(regions: list[Region], width: int, height: int) -> list[PlacedPart]:
    """Map color-tagged regions to mannequin slots and shape meshes.

    Assumes ``regions`` come from ``extract_regions``: every ``class_hint`` is set
    and the list is sorted by area (largest first).
    """
    if not regions:
        return []

    body = next((r for r in regions if r.class_hint == "body"), regions[0])
    parts: list[PlacedPart] = [make_part("body", body, width, height)]

    head = next((r for r in regions if r is not body and r.class_hint == "head"), None)
    if head:
        parts.append(make_part("head", head, width, height))

    def pick_side(class_hint: str, on_left: bool) -> Region | None:
        for r in regions:
            if r is body or r.class_hint != class_hint:
                continue
            if (r.center_x < body.center_x) == on_left:
                return r
        return None

    for class_hint, left_slot, right_slot in _PAIRED_SLOTS:
        left = pick_side(class_hint, on_left=True)
        right = pick_side(class_hint, on_left=False)
        if left:
            parts.append(make_part(left_slot, left, width, height))
        if right:
            parts.append(make_part(right_slot, right, width, height))
        # Mirror whichever side is present when the other is missing.
        add_symmetric(parts, left_slot, right_slot, "")

    if not any(p.slotId == "head" for p in parts):
        parts.append(
            PlacedPart(
                meshId="sphere",
                slotId="head",
                position=Vector3(x=0.0, y=0.0, z=0.0),
                scale=Vector3(x=1.0, y=1.0, z=1.0),
                rotation=Vector3(x=0.0, y=0.0, z=0.0),
                color=DEFAULT_COLOR,
            )
        )
    return parts


def build_pipeline_debug_image(original: np.ndarray, debug: RegionExtractionDebug) -> np.ndarray:
    """Compose a 2x2 debug canvas for original, masks, contours, and labels."""
    def panel(title: str, panel_image: np.ndarray) -> np.ndarray:
        """Annotate a debug panel image with a title."""
        pane = panel_image.copy()
        cv2.putText(
            pane,
            title,
            (12, 26),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.75,
            (255, 255, 255),
            2,
            cv2.LINE_AA,
        )
        return pane

    top_left = panel("Original image", original)
    top_right = panel("Overlay masks", debug.overlay_masks)
    bottom_left = panel("Detected contours", debug.detected_contours)
    bottom_right = panel("Labeled parts", debug.labeled_parts)
    top = np.hstack([top_left, top_right])
    bottom = np.hstack([bottom_left, bottom_right])
    return np.vstack([top, bottom])


def save_debug_pipeline_images(
    sketch_path: str, original: np.ndarray, debug: RegionExtractionDebug, pipeline: np.ndarray
) -> Path:
    """Persist debug pipeline artifacts into a timestamped run directory."""
    DEBUG_DIR.mkdir(parents=True, exist_ok=True)
    sketch_stem = Path(sketch_path).stem
    run_dir = DEBUG_DIR / f"{datetime.now().strftime('%Y%m%d-%H%M%S')}_{sketch_stem}"
    run_dir.mkdir(parents=True, exist_ok=True)

    outputs: list[tuple[str, np.ndarray]] = [
        ("original.png", original),
        ("overlay_masks.png", debug.overlay_masks),
        ("detected_contours.png", debug.detected_contours),
        ("labeled_parts.png", debug.labeled_parts),
        ("pipeline.png", pipeline),
    ]
    for filename, frame in outputs:
        ok = cv2.imwrite(str(run_dir / filename), frame)
        if not ok:
            raise HTTPException(status_code=500, detail=f"Failed to write debug image: {filename}")
    return run_dir


@app.get("/health")
def health() -> dict[str, str]:
    """Lightweight health check endpoint for service readiness."""
    return {"status": "ok"}


@app.post("/infer", response_model=InferResponse)
def infer(request: InferRequest) -> InferResponse:
    """Infer placed parts from a sketch and save debug pipeline images."""
    try:
        image_path = ensure_sketch_path(request.sketchPath)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Sketch file not found")

    image = cv2.imread(str(image_path))
    if image is None:
        raise HTTPException(status_code=422, detail="Failed to read sketch image")

    h, w = image.shape[:2]
    if max(h, w) > MAX_DIMENSION:
        scale = MAX_DIMENSION / max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    regions, debug = extract_regions(image, include_debug=True)
    if not regions or debug is None:
        raise HTTPException(status_code=422, detail="No color-coded parts detected")

    ih, iw = image.shape[:2]
    parts = map_regions(regions, iw, ih)
    pipeline = build_pipeline_debug_image(image, debug)
    save_debug_pipeline_images(request.sketchPath, image, debug, pipeline)
    return InferResponse(placedParts=parts)


@app.post("/infer-debug", response_model=InferDebugResponse)
def infer_debug(request: InferRequest) -> InferDebugResponse:
    """Run inference and return parts plus the written debug output directory."""
    try:
        image_path = ensure_sketch_path(request.sketchPath)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if not image_path.is_file():
        raise HTTPException(status_code=404, detail="Sketch file not found")

    image = cv2.imread(str(image_path))
    if image is None:
        raise HTTPException(status_code=422, detail="Failed to read sketch image")

    h, w = image.shape[:2]
    if max(h, w) > MAX_DIMENSION:
        scale = MAX_DIMENSION / max(h, w)
        image = cv2.resize(image, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)

    regions, debug = extract_regions(image, include_debug=True)
    if not regions or debug is None:
        raise HTTPException(status_code=422, detail="No color-coded parts detected")

    ih, iw = image.shape[:2]
    parts = map_regions(regions, iw, ih)
    pipeline = build_pipeline_debug_image(image, debug)
    run_dir = save_debug_pipeline_images(request.sketchPath, image, debug, pipeline)
    return InferDebugResponse(placedParts=parts, debugOutputDir=str(run_dir))
