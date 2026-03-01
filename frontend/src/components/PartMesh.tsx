import { useRef } from "react";
import { Mesh } from "three";
import type { PlacedPart } from "../types";

interface PartMeshProps {
  part: PlacedPart;
  slotPosition: [number, number, number];
  slotRotation: [number, number, number];
  selected: boolean;
  onClick: () => void;
}

/** Renders a single body part geometry by preset id */
function PartGeometry({ meshId }: { meshId: string }) {
  switch (meshId) {
    case "head":
      return <sphereGeometry args={[0.35, 24, 20]} />;
    case "body":
      return <cylinderGeometry args={[0.4, 0.5, 0.8, 24]} />;
    case "arm":
      return <cylinderGeometry args={[0.12, 0.1, 0.5, 16]} />;
    case "leg":
      return <cylinderGeometry args={[0.15, 0.12, 0.45, 16]} />;
    case "ear":
      return <coneGeometry args={[0.15, 0.35, 16]} />;
    case "tail":
      return <sphereGeometry args={[0.2, 16, 12]} />;
    default:
      return <boxGeometry args={[0.3, 0.3, 0.3]} />;
  }
}

export function PartMesh({ part, slotPosition, slotRotation, selected, onClick }: PartMeshProps) {
  const ref = useRef<Mesh>(null);

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
    >
      <mesh ref={ref} castShadow receiveShadow>
        <PartGeometry meshId={part.meshId} />
        <meshStandardMaterial
          color={part.color}
          roughness={0.8}
          metalness={0.1}
          emissive={selected ? "#333333" : "#000000"}
        />
      </mesh>
    </group>
  );
}
