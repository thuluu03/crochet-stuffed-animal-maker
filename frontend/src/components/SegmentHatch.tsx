import { useMemo } from "react";
import * as THREE from "three";

/**
 * Renders a cross-hatch overlay on all segment bands that are NOT in highlightSegments.
 * Uses screen-space diagonal lines so the pattern is always visible regardless of base color.
 * Two-tone lines (dark + light) ensure contrast on both light and dark shapes.
 */
export function SegmentHatch({
  geometry,
  segmentCount,
  yMin,
  yMax,
  yOffset = 0,
  highlightSegments,
}: {
  geometry: THREE.BufferGeometry;
  segmentCount: number;
  yMin: number;
  yMax: number;
  yOffset?: number;
  highlightSegments: number[];
}) {
  const material = useMemo(() => {
    const highlighted = new Array(64).fill(0.0);
    for (const seg of highlightSegments) {
      if (seg >= 0 && seg < 64) highlighted[seg] = 1.0;
    }
    return new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      uniforms: {
        segCount: { value: segmentCount },
        yMin:     { value: yMin },
        yMax:     { value: yMax },
        yOff:     { value: yOffset },
        highlighted: { value: highlighted },
      },
      vertexShader: `
        out float vLocalY;
        void main() {
          vLocalY = position.y;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        in float vLocalY;
        uniform float segCount;
        uniform float yMin;
        uniform float yMax;
        uniform float yOff;
        uniform float highlighted[64];
        out vec4 fragColor;
        void main() {
          float t = clamp((vLocalY + yOff - yMin) / (yMax - yMin), 0.0, 1.0);
          int segCountI = int(segCount);
          int seg = clamp(int(floor(t * segCount)), 0, segCountI - 1);
          if (highlighted[seg] > 0.5) discard;

          float d1 = mod(gl_FragCoord.x + gl_FragCoord.y, 18.0);
          float lineAlpha = d1 < 2.5 ? 0.75 : 0.28;
          fragColor = vec4(0.04, 0.1, 0.45, lineAlpha);
        }
      `,
    });
  }, [segmentCount, yMin, yMax, yOffset, highlightSegments]);

  return <mesh geometry={geometry} material={material} />;
}
