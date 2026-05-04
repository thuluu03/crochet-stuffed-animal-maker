import * as THREE from "three";

function positiveRadius(radius: number): number {
  return Math.max(radius, 0.001);
}

/**
 * Builds a cylinder-like lathe geometry with softened cap-to-side transitions.
 * The cap remains mostly flat, while the shoulder rounds outward slightly so
 * cylinders read more like stuffed fabric than hard primitives.
 */
export function roundedCylinderGeometry(
  topRadius: number,
  bottomRadius: number,
  height: number,
  radialSegments = 32,
  sideSegments = 8,
  cornerRatio = 0.16
): THREE.BufferGeometry {
  const top = positiveRadius(topRadius);
  const bottom = positiveRadius(bottomRadius);
  const halfHeight = height / 2;
  const maxRadius = Math.max(top, bottom);
  const minRadius = Math.min(top, bottom);
  const corner = Math.min(
    halfHeight * 0.42,
    minRadius * 0.52,
    maxRadius * cornerRatio
  );
  const edgeBulge = corner * 0.18;
  const points: THREE.Vector2[] = [];

  points.push(new THREE.Vector2(0, -halfHeight));
  points.push(new THREE.Vector2(Math.max(bottom - corner, 0.001), -halfHeight));

  for (let i = 1; i <= sideSegments; i++) {
    const t = i / sideSegments;
    const angle = -Math.PI / 2 + t * (Math.PI / 2);
    const radius = bottom - corner + (corner + edgeBulge) * Math.cos(angle);
    const y = -halfHeight + corner + corner * Math.sin(angle);
    points.push(new THREE.Vector2(radius, y));
  }

  const sideStartY = -halfHeight + corner;
  const sideEndY = halfHeight - corner;
  const sideCount = Math.max(2, sideSegments);
  for (let i = 1; i < sideCount; i++) {
    const t = i / sideCount;
    const radius = THREE.MathUtils.lerp(
      bottom + edgeBulge,
      top + edgeBulge,
      t
    );
    const y = THREE.MathUtils.lerp(sideStartY, sideEndY, t);
    points.push(new THREE.Vector2(radius, y));
  }

  for (let i = 0; i < sideSegments; i++) {
    const t = i / sideSegments;
    const angle = t * (Math.PI / 2);
    const radius = top - corner + (corner + edgeBulge) * Math.cos(angle);
    const y = halfHeight - corner + corner * Math.sin(angle);
    points.push(new THREE.Vector2(radius, y));
  }

  points.push(new THREE.Vector2(Math.max(top - corner, 0.001), halfHeight));
  points.push(new THREE.Vector2(0, halfHeight));

  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}

export function roundedConeGeometry(
  baseRadius: number,
  height: number,
  radialSegments = 28,
  sideSegments = 8,
  cornerRatio = 0.16,
  tipFrac = 0.13,
): THREE.BufferGeometry {
  const halfHeight = height / 2;
  const corner = Math.min(halfHeight * 0.42, baseRadius * cornerRatio);
  const edgeBulge = corner * 0.18;

  // Reserve a small cap near the apex and blend into it with a tangent-matched
  // cubic curve so the tip stays cone-like, but doesn't end in a hard spike.
  const tipCapHeight = tipFrac * height;
  const tipStartY = halfHeight - tipCapHeight;
  const sideSlope = (baseRadius + edgeBulge) / height;
  const tipR = tipCapHeight * sideSlope;

  const points: THREE.Vector2[] = [];

  points.push(new THREE.Vector2(0, -halfHeight));
  points.push(new THREE.Vector2(Math.max(baseRadius - corner, 0.001), -halfHeight));

  // Bottom rounding arc
  for (let i = 1; i <= sideSegments; i++) {
    const t = i / sideSegments;
    const angle = -Math.PI / 2 + t * (Math.PI / 2);
    const radius = baseRadius - corner + (corner + edgeBulge) * Math.cos(angle);
    const y = -halfHeight + corner + corner * Math.sin(angle);
    points.push(new THREE.Vector2(radius, y));
  }

  // Straight cone side up to the tip cap start
  const sideStartY = -halfHeight + corner;
  if (tipStartY > sideStartY + 0.001) {
    const midY = (sideStartY + tipStartY) / 2;
    const midR = (halfHeight - midY) * (baseRadius + edgeBulge) / height;
    points.push(new THREE.Vector2(midR, midY));
    points.push(new THREE.Vector2(tipR, tipStartY));
  }

  // Cubic tip dome: tangent to the cone side at the join, then flattening
  // into the apex so the silhouette reads slightly rounder.
  const handleX = tipR * 0.46;
  const handleY = handleX / sideSlope;
  const p0 = new THREE.Vector2(tipR, tipStartY);
  const p1 = new THREE.Vector2(
    Math.max(tipR - handleX, 0.001),
    tipStartY + handleY,
  );
  const p2 = new THREE.Vector2(tipR * 0.16, halfHeight);
  const p3 = new THREE.Vector2(0, halfHeight);
  const nDome = Math.max(sideSegments, 10);
  for (let i = 1; i <= nDome; i++) {
    const t = i / nDome;
    const mt = 1 - t;
    const radius =
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x;
    const y =
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y;
    points.push(new THREE.Vector2(radius, y));
  }

  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}

export function capsuleTeardropGeometry(
  radius = 0.14,
  minY = -0.18,
  maxY = 0.7,
  radialSegments = 32,
  profileSegments = 14
): THREE.BufferGeometry {
  const halfHeight = (maxY - minY) / 2;
  const bodySideLength = Math.min(radius * 1.55, halfHeight * 0.82);
  const outerCapLength = radius * 1.6;
  const outerCapStartY = maxY - outerCapLength;
  const points: THREE.Vector2[] = [];

  points.push(new THREE.Vector2(0, minY));

  for (let i = 1; i <= profileSegments; i++) {
    const t = i / profileSegments;
    const angle = t * (Math.PI / 2);
    points.push(
      new THREE.Vector2(
        radius * Math.pow(Math.sin(angle), 1.55),
        minY + bodySideLength * (1 - Math.cos(angle))
      )
    );
  }

  points.push(new THREE.Vector2(radius, outerCapStartY));

  for (let i = 1; i <= profileSegments; i++) {
    const t = i / profileSegments;
    const angle = t * (Math.PI / 2);
    points.push(
      new THREE.Vector2(
        radius * Math.cos(angle),
        outerCapStartY + outerCapLength * Math.sin(angle)
      )
    );
  }

  points.push(new THREE.Vector2(0, maxY));

  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}

export function roundedCapsuleGeometry(
  radius = 0.22,
  minY = -0.3,
  maxY = 0.3,
  radialSegments = 36,
  profileSegments = 14
): THREE.BufferGeometry {
  const halfHeight = (maxY - minY) / 2;
  const capRadius = Math.min(radius, halfHeight);
  const bottomCenterY = minY + capRadius;
  const topCenterY = maxY - capRadius;
  const points: THREE.Vector2[] = [];

  points.push(new THREE.Vector2(0, minY));

  for (let i = 1; i <= profileSegments; i++) {
    const t = i / profileSegments;
    const angle = -Math.PI / 2 + t * (Math.PI / 2);
    points.push(
      new THREE.Vector2(
        capRadius * Math.cos(angle),
        bottomCenterY + capRadius * Math.sin(angle)
      )
    );
  }

  points.push(new THREE.Vector2(capRadius, topCenterY));

  for (let i = 1; i <= profileSegments; i++) {
    const t = i / profileSegments;
    const angle = t * (Math.PI / 2);
    points.push(
      new THREE.Vector2(
        capRadius * Math.cos(angle),
        topCenterY + capRadius * Math.sin(angle)
      )
    );
  }

  points.push(new THREE.Vector2(0, maxY));

  const geometry = new THREE.LatheGeometry(points, radialSegments);
  geometry.computeVertexNormals();
  return geometry;
}
