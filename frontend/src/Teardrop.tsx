import { useMemo } from "react";
import * as THREE from "three";
import { Outlines } from "@react-three/drei";
import {
  addSegmentVertexColorsWithRange,
  TEARDROP_MIN_Y,
  TEARDROP_MAX_Y,
} from "./segmentColors";

/** Sphere at origin radius 0.18; cone at y=0.35 with height 0.7, radius 0.18. Cone uses small top radius to avoid black apex. */
const TEARDROP_SPHERE_RADIUS = 0.18;
const TEARDROP_CONE_HEIGHT = 0.7;
const TEARDROP_CONE_POSITION_Y = 0.35;

interface TeardropProps {
  color?: string;
  emissive?: string;
  showOutline?: boolean;
  outlineColor?: string;
  outlineThickness?: number;
  segmentCount?: number;
  segmentColors?: Record<number, string>;
}

export function Teardrop({
  color = "#9fd0ea",
  emissive = "#000000",
  showOutline = false,
  outlineColor = "#4fc3f7",
  outlineThickness = 0.03,
  segmentCount = 0,
  segmentColors,
}: TeardropProps) {
  const sphereGeom = useMemo(
    () => new THREE.SphereGeometry(TEARDROP_SPHERE_RADIUS, 32, 32),
    []
  );
  const coneGeom = useMemo(
    () =>
      new THREE.CylinderGeometry(
        0.001,
        TEARDROP_SPHERE_RADIUS,
        TEARDROP_CONE_HEIGHT,
        32,
        24
      ),
    []
  );

  const coloredSphereGeom = useMemo(() => {
    if (segmentCount <= 0) return null;
    return addSegmentVertexColorsWithRange(
      sphereGeom.clone(),
      segmentCount,
      color,
      segmentColors,
      TEARDROP_MIN_Y,
      TEARDROP_MAX_Y,
      0
    );
  }, [sphereGeom, segmentCount, color, segmentColors]);

  const coloredConeGeom = useMemo(() => {
    if (segmentCount <= 0) return null;
    return addSegmentVertexColorsWithRange(
      coneGeom.clone(),
      segmentCount,
      color,
      segmentColors,
      TEARDROP_MIN_Y,
      TEARDROP_MAX_Y,
      TEARDROP_CONE_POSITION_Y
    );
  }, [coneGeom, segmentCount, color, segmentColors]);

  if (segmentCount > 0 && coloredSphereGeom && coloredConeGeom) {
    return (
      <group>
        <mesh position={[0, TEARDROP_CONE_POSITION_Y, 0]} castShadow receiveShadow>
          <primitive object={coloredConeGeom} attach="geometry" />
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
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <primitive object={coloredSphereGeom} attach="geometry" />
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
      </group>
    );
  }

  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <coneGeometry args={[0.18, 0.7, 32]} />
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

      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
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
    </group>
  );
}
