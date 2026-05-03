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
    """Estimate the dominant contour orientation in radians using PCA."""
    if len(points) < 2:
        return 0.0
    mean = np.mean(points, axis=0)
    centered = points - mean
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eig(cov)
    principal = eigvecs[:, int(np.argmax(eigvals))]
    return float(math.atan2(principal[1], principal[0]))


def classify(region: Region, body_area: float) -> Literal["head", "body", "limb", "ear"]:
    """Heuristically classify a region by size and shape relative to the body."""
    if region.area > body_area * 0.55:
        return "body"
    if region.area > body_area * 0.12 and region.circularity > 0.55:
        return "head"
    if region.area < body_area * 0.08 and region.aspect_ratio < 1.4 and region.circularity > 0.6:
        return "ear"
    return "limb"


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


def scale_from_region(region: Region, width: int, height: int) -> Vector3:
    """Map a 2D region size to a plausible 3D part scale."""
    norm_w = max(0.2, (region.width / width) * 4.0)
    norm_h = max(0.2, (region.height / height) * 4.0)
    return Vector3(x=norm_w, y=norm_h, z=min(norm_w, norm_h))


def slot_default_rotation(slot_id: str) -> Vector3:
    """Default part rotation per mannequin slot (must match frontend `MANNEQUIN_SLOTS`)."""
    z_by_slot: dict[str, float] = {
        "head": 0.0,
        "body": 0.0,
        "leftArm": 0.0,
        "rightArm": 0.0,
        "leftLeg": 0.0,
        "rightLeg": 0.0,
        "leftEar": 0.0,
        "rightEar": 0.0,
    }
    z = z_by_slot.get(slot_id, 0.0)
    return Vector3(x=0.0, y=0.0, z=z)


def make_part(slot_id: str, region: Region, width: int, height: int) -> PlacedPart:
    """Create a placed 3D part using a bare shape mesh (sphere/cylinder/cone).

    Local position and rotation follow mannequin snap defaults (zero offset, slot rotation);
    scale still reflects the detected region size.
    """
    return PlacedPart(
        meshId=region.shape or "sphere",
        slotId=slot_id,
        position=Vector3(x=0.0, y=0.0, z=0.0),
        scale=scale_from_region(region, width, height),
        rotation=slot_default_rotation(slot_id),
        color=DEFAULT_COLOR,
    )


def add_symmetric(parts: list[PlacedPart], left_slot: str, right_slot: str, _mesh_id: str) -> None:
    """Mirror one side part onto the opposite side when its pair is missing."""
    left = next((p for p in parts if p.slotId == left_slot), None)
    right = next((p for p in parts if p.slotId == right_slot), None)
    if left and not right:
        parts.append(
            PlacedPart(
                meshId=left.meshId,
                slotId=right_slot,
                position=Vector3(x=0.0, y=0.0, z=0.0),
                scale=left.scale,
                rotation=slot_default_rotation(right_slot),
                color=left.color,
            )
        )
    elif right and not left:
        parts.append(
            PlacedPart(
                meshId=right.meshId,
                slotId=left_slot,
                position=Vector3(x=0.0, y=0.0, z=0.0),
                scale=right.scale,
                rotation=slot_default_rotation(left_slot),
                color=right.color,
            )
        )

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

def map_regions(regions: list[Region], width: int, height: int) -> list[PlacedPart]:
    """Map extracted regions to mannequin slots and mesh presets."""
    if not regions:
        return []
    body = next((r for r in regions if r.class_hint == "body"), regions[0])

    for r in regions:
        if r.class_hint is None:
            # if colored labels for class hints are not provided, we assume the body part based on size and shape relative to the body
            r.class_hint = classify(r, body.area) 

    parts: list[PlacedPart] = [make_part("body", body, width, height)]

    candidates = [r for r in regions if r is not body and (r.class_hint == "head" or (r.center_y < body.center_y and r.area >= body.area * 0.08))]
    head = candidates[0] if candidates else None
    if head:
        parts.append(make_part("head", head, width, height))

    rem = [r for r in regions if r is not body and r is not head]
    arm_band_delta = max(body.height * 0.8, 20)
    left_arms = sorted(
        [
            r
            for r in rem
            if r.center_x < body.center_x
            and (r.class_hint == "arm" or abs(r.center_y - body.center_y) <= arm_band_delta)
        ],
        key=lambda r: r.area,
        reverse=True,
    )
    right_arms = sorted(
        [
            r
            for r in rem
            if r.center_x >= body.center_x
            and (r.class_hint == "arm" or abs(r.center_y - body.center_y) <= arm_band_delta)
        ],
        key=lambda r: r.area,
        reverse=True,
    )
    if left_arms:
        parts.append(make_part("leftArm", left_arms[0], width, height))
    if right_arms:
        parts.append(make_part("rightArm", right_arms[0], width, height))

    legs = sorted(
        [r for r in rem if r.class_hint == "leg" or (r.center_y > body.center_y and r.area >= body.area * 0.03)],
        key=lambda r: r.area,
        reverse=True,
    )
    left_leg = next((r for r in legs if r.center_x < body.center_x), None)
    right_leg = next((r for r in legs if r.center_x >= body.center_x), None)
    if left_leg:
        parts.append(make_part("leftLeg", left_leg, width, height))
    if right_leg:
        parts.append(make_part("rightLeg", right_leg, width, height))

    ears = sorted([r for r in rem if r.class_hint == "ear" or (head and r.center_y < head.center_y + head.height * 0.2)], key=lambda r: r.area, reverse=True)
    left_ear = next((r for r in ears if r.center_x < body.center_x), None)
    right_ear = next((r for r in ears if r.center_x >= body.center_x), None)
    if left_ear:
        parts.append(make_part("leftEar", left_ear, width, height))
    if right_ear:
        parts.append(make_part("rightEar", right_ear, width, height))

    # NOTE: This adds a default shape to the parts that are missing a pair, which may not be what the user wants.
    add_symmetric(parts, "leftArm", "rightArm", "limb-teardrop")
    add_symmetric(parts, "leftLeg", "rightLeg", "limb-cylinder")
    add_symmetric(parts, "leftEar", "rightEar", "ear-teardrop")

    if not any(p.slotId == "head" for p in parts):
        parts.append(
            PlacedPart(
                meshId="sphere",
                slotId="head",
                position=Vector3(x=0.0, y=0.0, z=0.0),
                scale=Vector3(x=1.0, y=1.0, z=1.0),
                rotation=slot_default_rotation("head"),
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
