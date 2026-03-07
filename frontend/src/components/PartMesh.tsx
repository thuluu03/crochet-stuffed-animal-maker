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
    case "head-sphere":
      return <sphereGeometry args={[0.28, 28, 20]} />;
    case "head-cylinder":
      return <cylinderGeometry args={[0.22, 0.26, 0.46, 24]} />;
    case "body-sphere":
      return <sphereGeometry args={[0.44, 32, 24]} />;
    case "body":
    case "body-cylinder":
      return <cylinderGeometry args={[0.34, 0.4, 0.82, 28]} />;
    case "body-cone":
      return <coneGeometry args={[0.38, 0.84, 28]} />;
    case "arm":
    case "leg":
    case "limb-cylinder":
      return <cylinderGeometry args={[0.08, 0.09, 0.56, 18]} />;
    case "limb-sphere":
      return <sphereGeometry args={[0.15, 20, 16]} />;
    case "ear-sphere":
      return <sphereGeometry args={[0.1, 18, 14]} />;
    case "ear-cylinder":
      return <cylinderGeometry args={[0.07, 0.07, 0.24, 18]} />;
    case "ear":
    case "ear-cone":
      return <coneGeometry args={[0.12, 0.3, 18]} />;
    case "ear-circle":
      return <cylinderGeometry args={[0.14, 0.14, 0.035, 24]} />;
    case "tail":
      return <sphereGeometry args={[0.2, 16, 12]} />;
    case "sphere":
      return <sphereGeometry args={[0.24, 24, 18]} />;
    case "cylinder":
      return <cylinderGeometry args={[0.16, 0.16, 0.5, 20]} />;
    case "cone":
      return <coneGeometry args={[0.2, 0.5, 20]} />;
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
