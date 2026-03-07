import { useMemo } from "react";
import type { PlacedPart } from "../types";
import { Teardrop } from "../Teardrop";
import { Outlines } from "@react-three/drei";
import { useState } from "react";
import {
  addSegmentVertexColors,
  getBaseGeometry,
  isTeardropType,
} from "../segmentColors";
import { getSegmentCount } from "../presets";
import * as THREE from "three";

interface PartMeshProps {
  part: PlacedPart;
  slotPosition: [number, number, number];
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
}

interface PartGeometryProps {
  meshId: string;
  slotId: string;
  color: string;
  emissive: string;
  showOutline: boolean;
  segmentCount: number;
  rowColors?: Record<number, string>;
}

/** Renders a mesh with vertex colors by segment (horizontal bands). */
function SegmentColoredMesh({
  meshId,
  segmentCount,
  color,
  rowColors,
  emissive,
  showOutline,
}: {
  meshId: string;
  segmentCount: number;
  color: string;
  rowColors?: Record<number, string>;
  emissive: string;
  showOutline: boolean;
}) {
  const baseGeom = useMemo(() => getBaseGeometry(meshId), [meshId]);
  const coloredGeom = useMemo(() => {
    if (!baseGeom || segmentCount <= 0) return baseGeom;
    return addSegmentVertexColors(
      baseGeom.clone(),
      segmentCount,
      color,
      rowColors
    );
  }, [baseGeom, segmentCount, color, rowColors]);

  if (!coloredGeom) return null;

  return (
    <mesh castShadow receiveShadow>
      <primitive object={coloredGeom} attach="geometry" />
      <meshStandardMaterial
        vertexColors
        roughness={0.8}
        metalness={0.1}
        emissive={emissive}
      />
      {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
    </mesh>
  );
}

function getTeardropRotation(
  meshId: string,
  slotId: string,
): [number, number, number] {
  if (meshId === "ear-teardrop" || meshId === "limb-teardrop") {
    if (slotId === "leftEar" || slotId === "leftArm")
      return [0, 0, Math.PI / 2];
    if (slotId === "rightEar" || slotId === "rightArm")
      return [0, 0, -Math.PI / 2];
  }

  return [0, 0, 0];
}

function getTeardropOffset(
  meshId: string,
  slotId: string,
): [number, number, number] {
  if (meshId === "ear-teardrop") {
    if (slotId === "leftEar") return [-0.24, 0, 0];
    if (slotId === "rightEar") return [0.24, 0, 0];
  }

  return [0, 0, 0];
}

/** Renders a single body part geometry by preset id */
function PartGeometry({
  meshId,
  slotId,
  color,
  emissive,
  showOutline,
  segmentCount,
  rowColors,
}: PartGeometryProps) {
  if (
    segmentCount > 0 &&
    !isTeardropType(meshId) &&
    getBaseGeometry(meshId) != null
  ) {
    return (
      <SegmentColoredMesh
        meshId={meshId}
        segmentCount={segmentCount}
        color={color}
        rowColors={rowColors}
        emissive={emissive}
        showOutline={showOutline}
      />
    );
  }

  const teardropRotation = getTeardropRotation(meshId, slotId);
  const teardropOffset = getTeardropOffset(meshId, slotId);

  switch (meshId) {
    case "head":
    case "head-sphere":
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.28, 28, 20]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "head-cylinder":
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.22, 0.26, 0.46, 24]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "body-sphere":
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.44, 32, 24]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#FFFF00" />}
        </mesh>
      );
    case "body":
    case "body-cylinder":
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.4, 0.82, 28]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "body-cone":
      return (
        <mesh castShadow receiveShadow>
          <coneGeometry args={[0.38, 0.84, 28]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "body-teardrop":
      return (
        <group
          position={teardropOffset}
          rotation={teardropRotation}
          scale={[1.1, 0.95, 1.1]}
        >
          <Teardrop color={color} emissive={emissive} showOutline={showOutline} />
        </group>
      );
    case "arm":
    case "leg":
    case "limb-cylinder":
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.08, 0.09, 0.56, 18]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "limb-sphere":
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.15, 20, 16]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "limb-teardrop":
      return (
        <group
          position={teardropOffset}
          rotation={teardropRotation}
          scale={[0.38, 0.52, 0.38]}
        >
          <Teardrop color={color} emissive={emissive} showOutline={showOutline} />
        </group>
      );
    case "ear-sphere":
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.1, 18, 14]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "ear-cylinder":
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.07, 0.07, 0.24, 18]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "ear":
    case "ear-cone":
      return (
        <mesh castShadow receiveShadow>
          <coneGeometry args={[0.12, 0.3, 18]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "ear-circle":
      return (
        <mesh castShadow receiveShadow rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.14, 0.14, 0.035, 24]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "ear-teardrop":
      return (
        <group
          position={teardropOffset}
          rotation={teardropRotation}
          scale={[0.3, 0.36, 0.3]}
        >
          <Teardrop color={color} emissive={emissive} showOutline={showOutline} />
        </group>
      );
    case "tail":
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.2, 16, 12]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "sphere":
      return (
        <mesh castShadow receiveShadow>
          <sphereGeometry args={[0.24, 24, 18]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "cylinder":
      return (
        <mesh castShadow receiveShadow>
          <cylinderGeometry args={[0.16, 0.16, 0.5, 20]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
    case "cone":
      return (
        <mesh castShadow receiveShadow>
          <coneGeometry args={[0.2, 0.5, 20]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {/* {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />} */}
        </mesh>
      );
    default:
      return (
        <mesh castShadow receiveShadow>
          <boxGeometry args={[0.3, 0.3, 0.3]} />
          <meshStandardMaterial
            color={color}
            roughness={0.8}
            metalness={0.1}
            emissive={emissive}
          />
          {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
        </mesh>
      );
  }
}

export function PartMesh({
  part,
  slotPosition,
  selected,
  onClick,
  onHover
}: PartMeshProps) {
  const emissive = selected ? "#333333" : "#000000";
  const [hovered, setHovered] = useState(false);

  return (
    <group
      position={[
        slotPosition[0] + part.position[0],
        slotPosition[1] + part.position[1],
        slotPosition[2] + part.position[2],
      ]}
      rotation={[part.rotation[0], part.rotation[1], part.rotation[2]]}
      scale={part.scale}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        onHover();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
        onHover();
      }}
    >
      <PartGeometry
        meshId={part.meshId}
        slotId={part.slotId}
        color={part.color}
        emissive={emissive}
        showOutline={hovered}
        segmentCount={getSegmentCount(part.meshId)}
        rowColors={part.rowColors}
      />
    </group>
  );
}
