from __future__ import annotations

import math
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import cv2
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel


app = FastAPI(title="Sketch Inference Service")

SKETCHES_DIR = Path(os.getenv("SKETCHES_DIR", Path.cwd() / "data" / "sketches")).resolve()
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
    class_hint: Literal["head", "body", "limb", "ear"] | None = None


def ensure_sketch_path(relative_path: str) -> Path:
    candidate = relative_path.strip()
    if not candidate:
        raise ValueError("sketchPath is required")
    target = (SKETCHES_DIR / candidate).resolve()
    if SKETCHES_DIR not in target.parents and target != SKETCHES_DIR:
        raise ValueError("sketchPath must stay inside data/sketches")
    return target


def pca_orientation(points: np.ndarray) -> float:
    if len(points) < 2:
        return 0.0
    mean = np.mean(points, axis=0)
    centered = points - mean
    cov = np.cov(centered.T)
    eigvals, eigvecs = np.linalg.eig(cov)
    principal = eigvecs[:, int(np.argmax(eigvals))]
    return float(math.atan2(principal[1], principal[0]))


def classify(region: Region, body_area: float) -> Literal["head", "body", "limb", "ear"]:
    if region.area > body_area * 0.55:
        return "body"
    if region.area > body_area * 0.12 and region.circularity > 0.55:
        return "head"
    if region.area < body_area * 0.08 and region.aspect_ratio < 1.4 and region.circularity > 0.6:
        return "ear"
    return "limb"


def scale_from_region(region: Region, width: int, height: int) -> Vector3:
    norm_w = max(0.2, (region.width / width) * 4.0)
    norm_h = max(0.2, (region.height / height) * 4.0)
    return Vector3(x=norm_w, y=max(0.2, norm_h * 0.5), z=norm_w)


def pos_from_region(region: Region, width: int, height: int) -> Vector3:
    return Vector3(
        x=((region.center_x / width) - 0.5) * 1.2,
        y=((height - region.center_y) / height - 0.5) * 1.8,
        z=0.0,
    )


def make_part(slot_id: str, mesh_id: str, region: Region, width: int, height: int) -> PlacedPart:
    return PlacedPart(
        meshId=mesh_id,
        slotId=slot_id,
        position=pos_from_region(region, width, height),
        scale=scale_from_region(region, width, height),
        rotation=Vector3(x=0.0, y=0.0, z=region.orientation),
        color=DEFAULT_COLOR,
    )


def add_symmetric(parts: list[PlacedPart], left_slot: str, right_slot: str, mesh_id: str) -> None:
    left = next((p for p in parts if p.slotId == left_slot), None)
    right = next((p for p in parts if p.slotId == right_slot), None)
    if left and not right:
        parts.append(
            PlacedPart(
                meshId=mesh_id,
                slotId=right_slot,
                position=Vector3(x=-left.position.x, y=left.position.y, z=left.position.z),
                scale=left.scale,
                rotation=Vector3(x=left.rotation.x, y=left.rotation.y, z=-left.rotation.z),
                color=left.color,
            )
        )
    elif right and not left:
        parts.append(
            PlacedPart(
                meshId=mesh_id,
                slotId=left_slot,
                position=Vector3(x=-right.position.x, y=right.position.y, z=right.position.z),
                scale=right.scale,
                rotation=Vector3(x=right.rotation.x, y=right.rotation.y, z=-right.rotation.z),
                color=right.color,
            )
        )


def extract_regions(image: np.ndarray) -> list[Region]:
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gray = cv2.equalizeHist(gray)
    binary = cv2.adaptiveThreshold(
        gray, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 21, 7
    )
    denoised = cv2.medianBlur(binary, 3)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    opened = cv2.morphologyEx(denoised, cv2.MORPH_OPEN, kernel)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel)

    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    height, width = gray.shape[:2]
    min_area = max(40, int(width * height * 0.0005))

    regions: list[Region] = []
    for contour in contours:
        area = float(cv2.contourArea(contour))
        if area < min_area:
            continue
        x, y, w, h = cv2.boundingRect(contour)
        perimeter = float(cv2.arcLength(contour, True))
        moments = cv2.moments(contour)
        cx = moments["m10"] / moments["m00"] if moments["m00"] else x + w / 2
        cy = moments["m01"] / moments["m00"] if moments["m00"] else y + h / 2
        points = contour.reshape(-1, 2).astype(np.float32)
        circularity = (4 * math.pi * area / (perimeter * perimeter)) if perimeter else 0.0
        regions.append(
            Region(
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
            )
        )
    regions.sort(key=lambda r: r.area, reverse=True)
    return regions


def map_regions(regions: list[Region], width: int, height: int) -> list[PlacedPart]:
    if not regions:
        return []
    body = regions[0]
    for r in regions:
        r.class_hint = classify(r, body.area)

    parts: list[PlacedPart] = [make_part("body", "body-teardrop", body, width, height)]

    candidates = [r for r in regions[1:] if r.class_hint == "head" or (r.center_y < body.center_y and r.area >= body.area * 0.08)]
    head = candidates[0] if candidates else None
    if head:
        parts.append(make_part("head", "head-sphere", head, width, height))

    rem = [r for r in regions if r is not body and r is not head]
    arm_band_delta = max(body.height * 0.8, 20)
    left_arms = sorted([r for r in rem if r.center_x < body.center_x and abs(r.center_y - body.center_y) <= arm_band_delta], key=lambda r: r.area, reverse=True)
    right_arms = sorted([r for r in rem if r.center_x >= body.center_x and abs(r.center_y - body.center_y) <= arm_band_delta], key=lambda r: r.area, reverse=True)
    if left_arms:
        parts.append(make_part("leftArm", "limb-teardrop", left_arms[0], width, height))
    if right_arms:
        parts.append(make_part("rightArm", "limb-teardrop", right_arms[0], width, height))

    legs = sorted([r for r in rem if r.center_y > body.center_y and r.area >= body.area * 0.03], key=lambda r: r.area, reverse=True)
    left_leg = next((r for r in legs if r.center_x < body.center_x), None)
    right_leg = next((r for r in legs if r.center_x >= body.center_x), None)
    if left_leg:
        parts.append(make_part("leftLeg", "limb-cylinder", left_leg, width, height))
    if right_leg:
        parts.append(make_part("rightLeg", "limb-cylinder", right_leg, width, height))

    ears = sorted([r for r in rem if r.class_hint == "ear" or (head and r.center_y < head.center_y + head.height * 0.2)], key=lambda r: r.area, reverse=True)
    left_ear = next((r for r in ears if r.center_x < body.center_x), None)
    right_ear = next((r for r in ears if r.center_x >= body.center_x), None)
    if left_ear:
        parts.append(make_part("leftEar", "ear-teardrop", left_ear, width, height))
    if right_ear:
        parts.append(make_part("rightEar", "ear-teardrop", right_ear, width, height))

    add_symmetric(parts, "leftArm", "rightArm", "limb-teardrop")
    add_symmetric(parts, "leftLeg", "rightLeg", "limb-cylinder")
    add_symmetric(parts, "leftEar", "rightEar", "ear-teardrop")

    if not any(p.slotId == "head" for p in parts):
        parts.append(
            PlacedPart(
                meshId="head-sphere",
                slotId="head",
                position=Vector3(x=0.0, y=0.64, z=0.0),
                scale=Vector3(x=0.9, y=0.9, z=0.9),
                rotation=Vector3(x=0.0, y=0.0, z=0.0),
                color=DEFAULT_COLOR,
            )
        )
    return parts


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/infer", response_model=InferResponse)
def infer(request: InferRequest) -> InferResponse:
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

    regions = extract_regions(image)
    if not regions:
        raise HTTPException(status_code=422, detail="No sketch silhouette detected")

    ih, iw = image.shape[:2]
    parts = map_regions(regions, iw, ih)
    return InferResponse(placedParts=parts)
