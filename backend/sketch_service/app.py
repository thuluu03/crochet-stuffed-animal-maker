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
    """A color-tagged contour with the geometric features the placement code consumes."""

    min_x: int
    min_y: int
    max_x: int
    max_y: int
    area: float
    center_x: float
    center_y: float
    width: int
    height: int
    orientation: float
    class_hint: Literal["head", "body", "arm", "leg"] | None = None
    # FIXME: Include teardrop once the frontend exposes a teardrop preset for inference.
    shape: Literal["sphere", "cylinder", "cone"] | None = None


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


def shape_from_contour(contour: np.ndarray) -> Literal["sphere", "cylinder", "cone"]:
    """Classify a contour as sphere/cylinder/cone using how full its rotated bounding box is.

    The classifier hinges on a single rotation-invariant ratio:

        extent = contourArea / minAreaRect.area

    For ideal shapes this ratio sits at three well-separated values:
      - rectangle  ~ 1.0
      - ellipse / circle ~ pi / 4 (~0.785)
      - triangle   ~ 0.5

    Pure ``extent`` thresholds are used for the rectangle and ellipse branches, since
    those buckets stay clean even with pixel-level noise. ``approxPolyDP`` is consulted
    only as a tiebreaker for triangles, where vertex count is the most reliable cue.
    """
    area = float(cv2.contourArea(contour))
    perimeter = float(cv2.arcLength(contour, True))
    if area <= 0 or perimeter <= 0:
        return "sphere"

    (_, _), (rw, rh), _ = cv2.minAreaRect(contour)
    extent = area / max(1.0, float(rw) * float(rh))

    approx = cv2.approxPolyDP(contour, epsilon=0.04 * perimeter, closed=True)

    if extent >= 0.85:
        return "cylinder"
    if len(approx) == 3 or extent <= 0.6:
        return "cone"
    return "sphere"


def region_from_contour(contour: np.ndarray, class_hint: Literal["head", "body", "arm", "leg"]) -> Region:
    """Build a Region from a contour, capturing only the features the placement code reads.

    Center is taken from image moments (more accurate than the bounding-box center for
    asymmetric shapes), and the principal-axis orientation comes from PCA on the
    contour points so cylinders can be rotated to match elongated rectangles.
    """
    area = float(cv2.contourArea(contour))
    x, y, w, h = cv2.boundingRect(contour)
    moments = cv2.moments(contour)
    cx = moments["m10"] / moments["m00"] if moments["m00"] else x + w / 2
    cy = moments["m01"] / moments["m00"] if moments["m00"] else y + h / 2
    points = contour.reshape(-1, 2).astype(np.float32)
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


def scale_from_region(slot_id: str, region: Region, width: int, height: int) -> Vector3:
    """3D scale matched to the region, accounting for the mesh's local axes after rotation.

    All pixel sizes are normalized through ``normalized_dim`` so they share a single
    image-side denominator (avoids skew when the image is non-square) and never fall
    below ``_MIN_SCALE``.

    - ``sphere``: ``x``/``y`` follow the rectangle's width/height so flat ellipses
      stay flat; ``z`` uses the smaller of the two so it remains visually thin
      rather than ballooning into a full sphere.
    - ``cone``: ``y`` is the apex-to-base length, ``x``/``z`` is the base radius.
      For arm slots the cone is rotated 90° so its length follows the rectangle's
      width; otherwise the cone stays apex-up so length follows height.
    - ``cylinder``: the mesh is rotated so its length lies along the rectangle's
      long axis, so ``y`` (length) follows the long side and ``x``/``z`` (radius)
      follow the short side. The circular caps end up at the short-side ends.
    """
    image_max = max(width, height)
    long_norm = normalized_dim(max(region.width, region.height), image_max)
    short_norm = normalized_dim(min(region.width, region.height), image_max)
    width_norm = normalized_dim(region.width, image_max)
    height_norm = normalized_dim(region.height, image_max)

    if region.shape == "sphere":
        return Vector3(x=width_norm, y=height_norm, z=min(width_norm, height_norm))
    if region.shape == "cone":
        if slot_id in ("leftArm", "rightArm"):
            return Vector3(x=height_norm, y=width_norm, z=height_norm)
        return Vector3(x=width_norm, y=height_norm, z=width_norm)
    return Vector3(x=short_norm, y=long_norm, z=short_norm)


# Z rotation that points a cone's apex (default +Y) toward the body anchor at the origin.
# A +Z rotation in Three.js sends +Y to -X (counterclockwise viewed from +Z), so the left
# arm needs -pi/2 and the right arm +pi/2. Legs already face the body (apex-up).
_CONE_APEX_TOWARD_BODY: dict[str, float] = {
    "leftArm": -math.pi / 2,
    "rightArm": math.pi / 2,
    "leftLeg": 0.0,
    "rightLeg": 0.0,
}


def part_rotation(slot_id: str, region: Region) -> Vector3:
    """Z rotation that aligns the mesh's natural axis with the contour and slot.

    - ``sphere``: no rotation (isotropic mesh).
    - ``cone``: defaults to apex-up. For limb slots (arm/leg), the apex is rotated
      to point toward the body so the limb attaches by its wide base.
    - ``cylinder``: rotate around Z so the mesh axis (+Y) lines up with the
      rectangle's long axis. This places the circular caps at the short-side ends.
    """
    if region.shape == "cylinder":
        return Vector3(x=0.0, y=0.0, z=region.orientation - math.pi / 2)
    if region.shape == "cone":
        return Vector3(x=0.0, y=0.0, z=_CONE_APEX_TOWARD_BODY.get(slot_id, 0.0))
    return Vector3(x=0.0, y=0.0, z=0.0)


def make_part(slot_id: str, region: Region, width: int, height: int) -> PlacedPart:
    """Build a placed 3D part snapped to ``slot_id`` with shape-aware scale/rotation."""
    return PlacedPart(
        meshId=region.shape or "sphere",
        slotId=slot_id,
        position=Vector3(x=0.0, y=0.0, z=0.0),
        scale=scale_from_region(slot_id, region, width, height),
        rotation=part_rotation(slot_id, region),
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


def add_symmetric(parts: list[PlacedPart], left_slot: str, right_slot: str) -> None:
    """If only one side of a pair is present, mirror it onto the other side."""
    left = next((p for p in parts if p.slotId == left_slot), None)
    right = next((p for p in parts if p.slotId == right_slot), None)
    if left and not right:
        parts.append(_mirror_part(left, right_slot))
    elif right and not left:
        parts.append(_mirror_part(right, left_slot))


def extract_regions(image: np.ndarray, include_debug: bool = False) -> tuple[list[Region], RegionExtractionDebug | None]:
    """Segment the sketch into color-tagged regions, sorted by area (largest first).

    For each part class (head/body/arm/leg), the function:
    1. Builds an HSV mask via ``merge_ranges`` over one or more inclusive HSV ranges
       (head uses two to wrap the red hue around 0/180).
    2. Cleans the mask with morphological open then close to remove speckle and seal
       small gaps along the contour.
    3. Extracts external contours and drops any below ``min_area`` (a fraction of the
       image area) to ignore stray pixels.
    4. Annotates three debug canvases (mask overlay, contour outlines, labeled bboxes)
       in lockstep so they line up with the produced regions.

    Returns the regions and, when ``include_debug`` is true, the three debug frames.
    """
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
    """Convert color-tagged regions into placed 3D parts on the mannequin.

    Pipeline:
    1. Pick the body region (largest blue blob, with a fallback to the largest
       region overall) — its centroid acts as the symmetry axis for L/R splits.
    2. Pick the head region (largest red blob), if present.
    3. For each paired class (arm/leg/ear), pick the largest matching region on
       each side of the body's centroid via ``pick_side``. Because ``regions`` is
       already sorted by area, the first match per side is the largest.
    4. Mirror any side that is missing its pair via ``add_symmetric``.
    5. Add a default sphere head if no head was detected so the mannequin is never
       headless.

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
        add_symmetric(parts, left_slot, right_slot)

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

    top = np.hstack([panel("Original image", original), panel("Overlay masks", debug.overlay_masks)])
    bottom = np.hstack([panel("Detected contours", debug.detected_contours), panel("Labeled parts", debug.labeled_parts)])
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


def _run_inference(sketch_path: str) -> tuple[list[PlacedPart], Path]:
    """Load a sketch, extract regions, place parts, and persist debug images.

    Steps:
    1. Resolve the sketch path through ``ensure_sketch_path`` to keep callers from
       reading files outside ``SKETCHES_DIR``.
    2. Read the image and downscale to ``MAX_DIMENSION`` so contour detection stays
       fast and consistent across input sizes.
    3. Run ``extract_regions`` (with debug frames) and bail out if nothing was found.
    4. Map regions to placed parts and write the debug bundle to disk.

    Raises ``HTTPException`` for caller-friendly errors and returns the parts plus the
    on-disk debug directory the caller can surface to the API consumer.
    """
    try:
        image_path = ensure_sketch_path(sketch_path)
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
    run_dir = save_debug_pipeline_images(sketch_path, image, debug, pipeline)
    return parts, run_dir


@app.get("/health")
def health() -> dict[str, str]:
    """Lightweight health check endpoint for service readiness."""
    return {"status": "ok"}


@app.post("/infer", response_model=InferResponse)
def infer(request: InferRequest) -> InferResponse:
    """Infer placed parts from a sketch and save debug pipeline images."""
    parts, _ = _run_inference(request.sketchPath)
    return InferResponse(placedParts=parts)


@app.post("/infer-debug", response_model=InferDebugResponse)
def infer_debug(request: InferRequest) -> InferDebugResponse:
    """Run inference and return parts plus the written debug output directory."""
    parts, run_dir = _run_inference(request.sketchPath)
    return InferDebugResponse(placedParts=parts, debugOutputDir=str(run_dir))
