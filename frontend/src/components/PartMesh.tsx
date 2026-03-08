import { useMemo, useRef, useEffect } from "react";
import type { PlacedPart } from "../types";
import { Teardrop } from "../Teardrop";
import { Outlines, useCursor, TransformControls } from "@react-three/drei";
import { useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  addSegmentVertexColors,
  getBaseGeometry,
  isTeardropType,
} from "../segmentColors";
import { getSegmentCount } from "../presets";
import * as THREE from "three";
import { setLiveScale, resetLiveScale } from "../liveTransformStore";

interface PartMeshProps {
  part: PlacedPart;
  slotPosition: [number, number, number];
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onScaleChange: (scale: [number, number, number]) => void;
}

interface PartGeometryProps {
  meshId: string;
  color: string;
  emissive: string;
  showOutline: boolean;
  outlineColor: string;
  outlineThickness: number;
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
  outlineColor,
  outlineThickness,
}: {
  meshId: string;
  segmentCount: number;
  color: string;
  rowColors?: Record<number, string>;
  emissive: string;
  showOutline: boolean;
  outlineColor: string;
  outlineThickness: number;
}) {
  const baseGeom = useMemo(() => getBaseGeometry(meshId), [meshId]);
  const coloredGeom = useMemo(() => {
    if (!baseGeom || segmentCount <= 0) return baseGeom;
    return addSegmentVertexColors(
      baseGeom.clone(),
      segmentCount,
      color,
      rowColors,
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
      {showOutline && (
        <Outlines thickness={outlineThickness} color={outlineColor} />
      )}
    </mesh>
  );
}

/** Renders a single body part geometry by preset id */
function PartGeometry({
  meshId,
  color,
  emissive,
  showOutline,
  outlineColor,
  outlineThickness,
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
        outlineColor={outlineColor}
        outlineThickness={outlineThickness}
      />
    );
  }

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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
        </mesh>
      );
    case "body-teardrop":
      return (
        <group
          position={[0, -0.2, 0]}
          rotation={[0, 0, 0]}
          scale={[1.6, 1.5, 1.6]}
        >
          <Teardrop
            color={color}
            emissive={emissive}
            showOutline={showOutline}
            outlineColor={outlineColor}
            outlineThickness={outlineThickness}
            segmentCount={segmentCount}
            segmentColors={rowColors}
          />
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
        </mesh>
      );
    case "limb-teardrop":
      return (
        <group
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          scale={[0.75, 0.75, 0.75]}
        >
          <Teardrop
            color={color}
            emissive={emissive}
            showOutline={showOutline}
            outlineColor={outlineColor}
            outlineThickness={outlineThickness}
            segmentCount={segmentCount}
            segmentColors={rowColors}
          />
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
        </mesh>
      );
    case "ear-teardrop":
      return (
        <group
          position={[0, 0, 0]}
          rotation={[Math.PI, 0, 0]}
          scale={[0.5, 0.36, 0.1]}
        >
          <Teardrop
            color={color}
            emissive={emissive}
            showOutline={showOutline}
            outlineColor={outlineColor}
            outlineThickness={outlineThickness}
            segmentCount={segmentCount}
            segmentColors={rowColors}
          />
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
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
          {showOutline && (
            <Outlines thickness={outlineThickness} color={outlineColor} />
          )}
        </mesh>
      );
  }
}

export function PartMesh({
  part,
  slotPosition,
  selected,
  onClick,
  onHover,
  onScaleChange,
}: PartMeshProps) {
  const emissive = selected ? "#2a2a2a" : "#000000";
  const [hovered, setHovered] = useState(false);
  const innerGroupRef = useRef<THREE.Group>(null) as React.MutableRefObject<THREE.Group>;
  const lastScaleRef = useRef({ x: 1, y: 1, z: 1 });
  useCursor(hovered && !selected, "pointer", "auto");

  // Imperatively set scale so R3F never resets it mid-drag.
  // Runs when part.scale changes (Apply / mouseUp) or when selected state changes (to initialise).
  useEffect(() => {
    if (innerGroupRef.current) {
      const [sx, sy, sz] = part.scale;
      innerGroupRef.current.scale.set(sx, sy, sz);
      lastScaleRef.current = { x: sx, y: sy, z: sz };
      resetLiveScale(sx, sy, sz);
    }
  }, [part.scale[0], part.scale[1], part.scale[2], selected]);

  // Poll scale every frame while selected and push to the live store.
  useFrame(() => {
    if (!selected || !innerGroupRef.current) return;
    const g = innerGroupRef.current;
    const last = lastScaleRef.current;
    if (g.scale.x !== last.x || g.scale.y !== last.y || g.scale.z !== last.z) {
      lastScaleRef.current = { x: g.scale.x, y: g.scale.y, z: g.scale.z };
      setLiveScale(g.scale.x, g.scale.y, g.scale.z);
    }
  });

  const outlineColor = selected ? "#ffffff" : hovered ? "#00e5ff" : "#ff9f1c";
  const outlineThickness = selected ? 0.065 : hovered ? 5 : 0.085;

  const geometry = (
    <PartGeometry
      meshId={part.meshId}
      color={part.color}
      emissive={emissive}
      showOutline={hovered || selected}
      outlineColor={outlineColor}
      outlineThickness={outlineThickness}
      segmentCount={getSegmentCount(part.meshId)}
      rowColors={part.rowColors}
    />
  );

  return (
    <group
      position={[
        slotPosition[0] + part.position[0],
        slotPosition[1] + part.position[1],
        slotPosition[2] + part.position[2],
      ]}
      rotation={[part.rotation[0], part.rotation[1], part.rotation[2]]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        if (!selected) setHovered(true);
        onHover();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        if (!selected) setHovered(false);
        onHover();
      }}
    >
      {/* Scale is managed imperatively via useEffect — no React scale prop here,
          so R3F never resets it during re-renders while TransformControls is active. */}
      <group ref={innerGroupRef}>
        {geometry}
      </group>

      {selected && (
        <TransformControls
          object={innerGroupRef}
          mode="scale"
          size={0.6}
          onMouseUp={() => {
            const g = innerGroupRef.current;
            if (!g) return;
            const clamp = (v: number) => Math.max(0.2, Math.min(3, v));
            onScaleChange([clamp(g.scale.x), clamp(g.scale.y), clamp(g.scale.z)]);
          }}
        />
      )}
    </group>
  );
}
