import { useMemo, useRef, useEffect } from "react";
import type { PlacedPart } from "../types";
import { Teardrop } from "../Teardrop";
import {
  Outlines,
  useCursor,
  TransformControls,
  useGLTF,
} from "@react-three/drei";
import { useState } from "react";
import { useFrame, createPortal, useThree } from "@react-three/fiber";
import {
  addSegmentVertexColors,
  addSegmentVertexColorsWithRange,
  getBaseGeometry,
  isTeardropType,
} from "../segmentColors";
import {
  roundedCapsuleGeometry,
  roundedCylinderGeometry,
} from "../roundedGeometry";
import * as THREE from "three";
import { computePatternRowCount } from "../patternRowCount";
import {
  setLiveScale,
  setLivePosition,
  setLiveRotation,
  resetLiveScale,
} from "../liveTransformStore";
import {
  getTransformMode,
  subscribeTransformMode,
} from "../transformModeStore";
import { getHighlight, subscribeHighlight } from "../highlightStore";
import { isEyedropperActive, pickEyedropperColor } from "../eyedropperStore";
import { SegmentHatch } from "./SegmentHatch";

interface PartMeshProps {
  part: PlacedPart;
  slotPosition: [number, number, number];
  selected: boolean;
  onClick: () => void;
  onHover: () => void;
  onTransformCommit: (
    updates: Partial<Pick<PlacedPart, "position" | "rotation" | "scale">>,
  ) => void;
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
  highlightSegments?: number[];
}

/** Renders a mesh with sharp per-row color bands using a 1D nearest-filter texture. */
function SegmentColoredMesh({
  meshId,
  segmentCount,
  color,
  rowColors,
  emissive,
  showOutline,
  outlineColor,
  outlineThickness,
  highlightSegments,
}: {
  meshId: string;
  segmentCount: number;
  color: string;
  rowColors?: Record<number, string>;
  emissive: string;
  showOutline: boolean;
  outlineColor: string;
  outlineThickness: number;
  highlightSegments?: number[];
}) {
  const baseGeom = useMemo(() => getBaseGeometry(meshId), [meshId]);
  const yBounds = useMemo(() => {
    if (!baseGeom) return null;
    baseGeom.computeBoundingBox();
    const bb = baseGeom.boundingBox!;
    return { yMin: bb.min.y, yMax: bb.max.y };
  }, [baseGeom]);
  const segmented = useMemo(() => {
    if (!baseGeom || segmentCount <= 0) return null;
    return addSegmentVertexColors(baseGeom.clone(), segmentCount, color, rowColors);
  }, [baseGeom, segmentCount, color, rowColors]);

  if (!baseGeom) return null;

  const rotation: [number, number, number] | undefined =
    meshId === "ear-circle" ? [Math.PI / 2, 0, 0] : undefined;

  return (
    <group>
      <mesh rotation={rotation} castShadow receiveShadow>
        <primitive object={segmented?.geometry ?? baseGeom} attach="geometry" />
        {segmented ? (
          <meshStandardMaterial map={segmented.texture} roughness={0.8} metalness={0.1} emissive={emissive} />
        ) : (
          <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} emissive={emissive} />
        )}
        {showOutline && <Outlines thickness={outlineThickness} color={outlineColor} />}
      </mesh>
      {highlightSegments && baseGeom && yBounds && (
        <SegmentHatch
          geometry={baseGeom}
          segmentCount={segmentCount}
          yMin={yBounds.yMin}
          yMax={yBounds.yMax}
          rotation={rotation}
          highlightSegments={highlightSegments}
        />
      )}
    </group>
  );
}

function RoundedCylinderMesh({
  topRadius,
  bottomRadius,
  height,
  radialSegments,
  color,
  emissive,
  showOutline,
  outlineColor,
  outlineThickness,
  rotation,
}: {
  topRadius: number;
  bottomRadius: number;
  height: number;
  radialSegments: number;
  color: string;
  emissive: string;
  showOutline: boolean;
  outlineColor: string;
  outlineThickness: number;
  rotation?: [number, number, number];
}) {
  const geometry = useMemo(
    () =>
      roundedCylinderGeometry(topRadius, bottomRadius, height, radialSegments),
    [topRadius, bottomRadius, height, radialSegments],
  );

  return (
    <mesh geometry={geometry} rotation={rotation} castShadow receiveShadow>
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

function RoundedCapsuleMesh({
  color,
  emissive,
  showOutline,
  outlineColor,
  outlineThickness,
  segmentCount,
  rowColors,
  highlightSegments,
}: {
  color: string;
  emissive: string;
  showOutline: boolean;
  outlineColor: string;
  outlineThickness: number;
  segmentCount: number;
  rowColors?: Record<number, string>;
  highlightSegments?: number[];
}) {
  const baseGeom = useMemo(
    () => roundedCapsuleGeometry(0.29, -0.38, 0.38, 36),
    [],
  );
  const segmented = useMemo(() => {
    if (segmentCount <= 0) return null;
    return addSegmentVertexColors(baseGeom.clone(), segmentCount, color, rowColors);
  }, [baseGeom, segmentCount, color, rowColors]);

  return (
    <group>
      <mesh geometry={segmented?.geometry ?? baseGeom} castShadow receiveShadow>
        {segmented ? (
          <meshStandardMaterial map={segmented.texture} roughness={0.8} metalness={0.1} emissive={emissive} />
        ) : (
          <meshStandardMaterial color={color} roughness={0.8} metalness={0.1} emissive={emissive} />
        )}
        {showOutline && (
          <Outlines thickness={outlineThickness} color={outlineColor} />
        )}
      </mesh>
      {highlightSegments && (
        <SegmentHatch
          geometry={baseGeom}
          segmentCount={segmentCount}
          yMin={-0.38}
          yMax={0.38}
          highlightSegments={highlightSegments}
        />
      )}
    </group>
  );
}

const CUSTOM_TEARDROP_URL = "/custom_teardrop.glb";
const CUSTOM_TEARDROP_TARGET_MAX_WIDTH_DEPTH = 0.58;
const CUSTOM_TEARDROP_TARGET_MIN_Y = -0.29;
useGLTF.clear(CUSTOM_TEARDROP_URL);
useGLTF.preload(CUSTOM_TEARDROP_URL);

/** Renders the custom teardrop GLB, with optional segment vertex colors. */
function CustomTeardropGLTF({
  color,
  emissive,
  showOutline,
  outlineColor,
  outlineThickness,
  segmentCount,
  rowColors,
  highlightSegments,
}: {
  color: string;
  emissive: string;
  showOutline: boolean;
  outlineColor: string;
  outlineThickness: number;
  segmentCount: number;
  rowColors?: Record<number, string>;
  highlightSegments?: number[];
}) {
  const { scene } = useGLTF(CUSTOM_TEARDROP_URL);

  // Bake each mesh's world transform into its cloned geometry.
  const bakedGeometries = useMemo(() => {
    const geoms: THREE.BufferGeometry[] = [];
    scene.updateMatrixWorld(true);
    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        const baked = mesh.geometry.clone();
        baked.applyMatrix4(mesh.matrixWorld);
        geoms.push(baked);
      }
    });
    return geoms;
  }, [scene]);

  // Normalize imported geometry to a deterministic app-space footprint.
  const normalized = useMemo(() => {
    if (bakedGeometries.length === 0) {
      return {
        geometries: [] as THREE.BufferGeometry[],
        bounds: null as THREE.Box3 | null,
      };
    }

    const sourceBounds = new THREE.Box3();
    for (const geom of bakedGeometries) {
      geom.computeBoundingBox();
      if (geom.boundingBox) sourceBounds.union(geom.boundingBox);
    }

    if (sourceBounds.isEmpty()) {
      return {
        geometries: bakedGeometries.map((g) => g.clone()),
        bounds: null as THREE.Box3 | null,
      };
    }

    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    sourceBounds.getSize(size);
    sourceBounds.getCenter(center);

    const maxWidthDepth = Math.max(size.x, size.z, 1e-6);
    const uniformScale = CUSTOM_TEARDROP_TARGET_MAX_WIDTH_DEPTH / maxWidthDepth;
    const tx = -center.x * uniformScale;
    const tz = -center.z * uniformScale;
    const ty = CUSTOM_TEARDROP_TARGET_MIN_Y - sourceBounds.min.y * uniformScale;

    const scaleMatrix = new THREE.Matrix4().makeScale(
      uniformScale,
      uniformScale,
      uniformScale,
    );
    const translateMatrix = new THREE.Matrix4().makeTranslation(tx, ty, tz);

    const normalizedGeometries = bakedGeometries.map((geom) => {
      const normalizedGeom = geom.clone();
      normalizedGeom.applyMatrix4(scaleMatrix);
      normalizedGeom.applyMatrix4(translateMatrix);
      normalizedGeom.deleteAttribute("normal");
      normalizedGeom.computeVertexNormals();
      return normalizedGeom;
    });

    const normalizedBounds = new THREE.Box3();
    for (const geom of normalizedGeometries) {
      geom.computeBoundingBox();
      if (geom.boundingBox) normalizedBounds.union(geom.boundingBox);
    }

    return {
      geometries: normalizedGeometries,
      bounds: normalizedBounds.isEmpty() ? null : normalizedBounds,
    };
  }, [bakedGeometries]);

  const coloredGeoms = useMemo(() => {
    if (segmentCount <= 0 || !normalized.bounds) return null;
    const minY = normalized.bounds.min.y;
    const maxY = normalized.bounds.max.y;
    return normalized.geometries.map((geom) =>
      addSegmentVertexColorsWithRange(
        geom,
        segmentCount,
        color,
        rowColors,
        minY,
        maxY,
        0,
      ),
    );
  }, [normalized, segmentCount, color, rowColors]);

  const meshes = normalized.geometries.map((geom, i) => {
    const sc = coloredGeoms?.[i];
    return (
      <mesh key={i} geometry={sc?.geometry ?? geom} castShadow receiveShadow>
        {sc ? (
          <meshStandardMaterial map={sc.texture} roughness={0.8} metalness={0.1} emissive={emissive} />
        ) : (
          <meshStandardMaterial color={color} emissive={emissive} roughness={0.8} metalness={0.1} />
        )}
        {showOutline && <Outlines thickness={outlineThickness} color={outlineColor} />}
      </mesh>
    );
  });

  const hatchOverlays =
    highlightSegments && normalized.bounds
      ? normalized.geometries.map((geom, i) => (
          <SegmentHatch
            key={`hatch-${i}`}
            geometry={geom}
            segmentCount={segmentCount}
            yMin={normalized.bounds!.min.y}
            yMax={normalized.bounds!.max.y}
            highlightSegments={highlightSegments}
          />
        ))
      : null;

  return (
    <group>
      {meshes}
      {hatchOverlays}
    </group>
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
  highlightSegments,
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
        highlightSegments={highlightSegments}
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
        <RoundedCylinderMesh
          topRadius={0.22}
          bottomRadius={0.26}
          height={0.46}
          radialSegments={32}
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
        />
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
        <RoundedCylinderMesh
          topRadius={0.34}
          bottomRadius={0.4}
          height={0.82}
          radialSegments={36}
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
        />
      );
    case "body-cone":
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
          highlightSegments={highlightSegments}
        />
      );
    case "body-teardrop":
      return (
        <RoundedCapsuleMesh
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
          segmentCount={segmentCount}
          rowColors={rowColors}
          highlightSegments={highlightSegments}
        />
      );
    case "arm":
    case "leg":
    case "limb-cylinder":
      return (
        <RoundedCylinderMesh
          topRadius={0.08}
          bottomRadius={0.09}
          height={0.56}
          radialSegments={24}
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
        />
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
            highlightSegments={highlightSegments}
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
        <RoundedCylinderMesh
          topRadius={0.07}
          bottomRadius={0.07}
          height={0.24}
          radialSegments={24}
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
        />
      );
    case "ear":
    case "ear-cone":
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
          highlightSegments={highlightSegments}
        />
      );
    case "ear-circle":
      return (
        <RoundedCylinderMesh
          topRadius={0.14}
          bottomRadius={0.14}
          height={0.035}
          radialSegments={32}
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
          rotation={[Math.PI / 2, 0, Math.PI / 2]}
        />
      );
    case "ear-teardrop":
      return (
        <group
          position={[0, -0.1, 0]}
          rotation={[0, 0, 0]}
          scale={[0.42, 0.3, 0.18]}
        >
          <Teardrop
            color={color}
            emissive={emissive}
            showOutline={showOutline}
            outlineColor={outlineColor}
            outlineThickness={outlineThickness}
            segmentCount={segmentCount}
            segmentColors={rowColors}
            highlightSegments={highlightSegments}
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
        <RoundedCylinderMesh
          topRadius={0.16}
          bottomRadius={0.16}
          height={0.5}
          radialSegments={28}
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
        />
      );
    case "cone":
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
          highlightSegments={highlightSegments}
        />
      );
    case "custom-teardrop":
    case "body-custom-teardrop":
      return (
        <CustomTeardropGLTF
          color={color}
          emissive={emissive}
          showOutline={showOutline}
          outlineColor={outlineColor}
          outlineThickness={outlineThickness}
          segmentCount={segmentCount}
          rowColors={rowColors}
          highlightSegments={highlightSegments}
        />
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
  const [highlight, setHighlightState] = useState(getHighlight);
  const outerGroupRef = useRef<THREE.Group>(
    null,
  ) as React.MutableRefObject<THREE.Group>;
  const lastScaleRef = useRef({ x: 1, y: 1, z: 1 });
  useCursor(hovered && !selected, "pointer", "auto");

  useEffect(() => {
    const unsub = subscribeTransformMode(setTransformMode);
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => subscribeHighlight(setHighlightState), []);

  const highlightSegments =
    highlight.instanceId === part.instanceId && highlight.segments.length > 0
      ? highlight.segments
      : undefined;

  // Imperatively sync position+rotation on outer group so R3F never resets them mid-drag.
  useEffect(() => {
    if (!outerGroupRef.current) return;
    outerGroupRef.current.position.set(
      slotPosition[0] + part.position[0],
      slotPosition[1] + part.position[1],
      slotPosition[2] + part.position[2],
    );
    outerGroupRef.current.rotation.set(
      part.rotation[0],
      part.rotation[1],
      part.rotation[2],
    );
  }, [
    part.position[0],
    part.position[1],
    part.position[2],
    part.rotation[0],
    part.rotation[1],
    part.rotation[2],
    slotPosition[0],
    slotPosition[1],
    slotPosition[2],
  ]);

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
    if (
      og.scale.x !== last.x ||
      og.scale.y !== last.y ||
      og.scale.z !== last.z
    ) {
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
      onTransformCommit({
        scale: [clamp(og.scale.x), clamp(og.scale.y), clamp(og.scale.z)],
      });
    } else if (transformMode === "translate") {
      onTransformCommit({
        position: [
          og.position.x - slotPosition[0],
          og.position.y - slotPosition[1],
          og.position.z - slotPosition[2],
        ],
      });
    } else if (transformMode === "rotate") {
      onTransformCommit({
        rotation: [og.rotation.x, og.rotation.y, og.rotation.z],
      });
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
      segmentCount={computePatternRowCount(part.meshId, part.scale)}
      rowColors={part.rowColors}
      highlightSegments={highlightSegments}
    />
  );

  return (
    <group
      ref={outerGroupRef}
      onClick={(e) => {
        e.stopPropagation();
        if (isEyedropperActive()) {
          const mesh = e.object as THREE.Mesh;
          const localPt = mesh.worldToLocal(e.point.clone());
          const geom = mesh.geometry;
          geom.computeBoundingBox();
          const bbox = geom.boundingBox;
          if (bbox && bbox.max.y > bbox.min.y) {
            const segCount = computePatternRowCount(part.meshId, part.scale);
            const t = Math.max(
              0,
              Math.min(1, (localPt.y - bbox.min.y) / (bbox.max.y - bbox.min.y)),
            );
            const seg = Math.min(
              segCount - 1,
              Math.max(0, Math.floor(t * segCount)),
            );
            pickEyedropperColor(part.rowColors?.[seg] ?? part.color);
          } else {
            pickEyedropperColor(part.color);
          }
          return;
        }
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

      {selected &&
        createPortal(
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
