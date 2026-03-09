import { useMemo, useRef, useEffect } from "react";
import type { PlacedPart } from "../types";
import { Teardrop } from "../Teardrop";
import { Outlines, useCursor, TransformControls } from "@react-three/drei";
import { useState } from "react";
import { useFrame, createPortal, useThree } from "@react-three/fiber";
import {
  addSegmentVertexColors,
  getBaseGeometry,
  isTeardropType,
} from "../segmentColors";
import { getSegmentCount } from "../presets";
import * as THREE from "three";
import { setLiveScale, setLivePosition, setLiveRotation, resetLiveScale } from "../liveTransformStore";
import { getTransformMode, subscribeTransformMode } from "../transformModeStore";

interface PartMeshProps {
  part: PlacedPart;
  slotPosition: [number, number, number];
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onTransformCommit: (updates: Partial<Pick<PlacedPart, "position" | "rotation" | "scale">>) => void;
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
  onTransformCommit,
}: PartMeshProps) {
  const emissive = "#000000";
  const { scene } = useThree();
  const [hovered, setHovered] = useState(false);
  const [transformMode, setTransformMode] = useState(getTransformMode);
  const outerGroupRef = useRef<THREE.Group>(null) as React.MutableRefObject<THREE.Group>;
  const lastScaleRef = useRef({ x: 1, y: 1, z: 1 });
  useCursor(hovered && !selected, "pointer", "auto");

  useEffect(() => {
    const unsub = subscribeTransformMode(setTransformMode);
    return () => { unsub(); };
  }, []);

  // Imperatively sync position+rotation on outer group so R3F never resets them mid-drag.
  useEffect(() => {
    if (!outerGroupRef.current) return;
    outerGroupRef.current.position.set(
      slotPosition[0] + part.position[0],
      slotPosition[1] + part.position[1],
      slotPosition[2] + part.position[2],
    );
    outerGroupRef.current.rotation.set(part.rotation[0], part.rotation[1], part.rotation[2]);
  }, [part.position[0], part.position[1], part.position[2], part.rotation[0], part.rotation[1], part.rotation[2], slotPosition[0], slotPosition[1], slotPosition[2]]);

  // Imperatively sync scale on outer group.
  useEffect(() => {
    if (!outerGroupRef.current) return;
    const [sx, sy, sz] = part.scale;
    outerGroupRef.current.scale.set(sx, sy, sz);
    lastScaleRef.current = { x: sx, y: sy, z: sz };
    resetLiveScale(sx, sy, sz);
  }, [part.scale[0], part.scale[1], part.scale[2], selected]);

  // Poll transforms every frame while selected and push to the live store.
  useFrame(() => {
    if (!selected) return;
    const og = outerGroupRef.current;
    if (!og) return;
    const last = lastScaleRef.current;
    if (og.scale.x !== last.x || og.scale.y !== last.y || og.scale.z !== last.z) {
      lastScaleRef.current = { x: og.scale.x, y: og.scale.y, z: og.scale.z };
      setLiveScale(og.scale.x, og.scale.y, og.scale.z);
    }
    setLivePosition(
      og.position.x - slotPosition[0],
      og.position.y - slotPosition[1],
      og.position.z - slotPosition[2],
    );
    setLiveRotation(og.rotation.x, og.rotation.y, og.rotation.z);
  });

  const handleMouseUp = () => {
    const og = outerGroupRef.current;
    if (!og) return;
    if (transformMode === "scale") {
      // Scale is on the outer group (TransformControls scales it directly)
      const clamp = (v: number) => Math.max(0.2, Math.min(3, v));
      onTransformCommit({ scale: [clamp(og.scale.x), clamp(og.scale.y), clamp(og.scale.z)] });
    } else if (transformMode === "translate") {
      onTransformCommit({
        position: [
          og.position.x - slotPosition[0],
          og.position.y - slotPosition[1],
          og.position.z - slotPosition[2],
        ],
      });
    } else if (transformMode === "rotate") {
      onTransformCommit({ rotation: [og.rotation.x, og.rotation.y, og.rotation.z] });
    }
  };

  const outlineColor = selected ? "#ffffff" : hovered ? "#00e5ff" : "#ff9f1c";
  const outlineThickness = hovered ? 5 : 0.03;

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
      ref={outerGroupRef}
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
      {geometry}

      {selected && createPortal(
        <TransformControls
          key={transformMode}
          object={outerGroupRef}
          mode={transformMode}
          size={0.9}
          onMouseUp={handleMouseUp}
        />,
        scene,
      )}
    </group>
  );
}
