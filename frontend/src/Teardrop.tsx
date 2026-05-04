import { useMemo } from "react";
import { Outlines } from "@react-three/drei";
import { SegmentHatch } from "./components/SegmentHatch";
import {
  addSegmentVertexColorsWithRange,
  TEARDROP_MIN_Y,
  TEARDROP_MAX_Y,
} from "./segmentColors";
import { capsuleTeardropGeometry } from "./roundedGeometry";

const TEARDROP_RADIUS = 0.14;

interface TeardropProps {
  color?: string;
  emissive?: string;
  showOutline?: boolean;
  outlineColor?: string;
  outlineThickness?: number;
  segmentCount?: number;
  segmentColors?: Record<number, string>;
  highlightSegments?: number[];
}

export function Teardrop({
  color = "#9fd0ea",
  emissive = "#000000",
  showOutline = false,
  outlineColor = "#4fc3f7",
  outlineThickness = 0.03,
  segmentCount = 0,
  segmentColors,
  highlightSegments,
}: TeardropProps) {
  const baseGeom = useMemo(
    () =>
      capsuleTeardropGeometry(
        TEARDROP_RADIUS,
        TEARDROP_MIN_Y,
        TEARDROP_MAX_Y,
        36,
      ),
    [],
  );

  const coloredGeom = useMemo(() => {
    if (segmentCount <= 0) return null;
    return addSegmentVertexColorsWithRange(
      baseGeom.clone(),
      segmentCount,
      color,
      segmentColors,
      TEARDROP_MIN_Y,
      TEARDROP_MAX_Y,
      0,
    );
  }, [baseGeom, segmentCount, color, segmentColors]);

  if (segmentCount > 0 && coloredGeom) {
    return (
      <group>
        <mesh castShadow receiveShadow>
          <primitive object={coloredGeom} attach="geometry" />
          <meshStandardMaterial
            vertexColors
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
        </mesh>
        {highlightSegments && (
          <SegmentHatch
            geometry={baseGeom}
            segmentCount={segmentCount}
            yMin={TEARDROP_MIN_Y}
            yMax={TEARDROP_MAX_Y}
            yOffset={0}
            highlightSegments={highlightSegments}
          />
        )}
      </group>
    );
  }

  return (
    <mesh castShadow receiveShadow>
      <primitive object={baseGeom} attach="geometry" />
      <meshStandardMaterial
        color={color}
        emissive={emissive}
        roughness={0.8}
        metalness={0.1}
      />
      {showOutline && (
        <Outlines thickness={outlineThickness} color={outlineColor} />
      )}
    </mesh>
  );
}
