import type { PlacedPart } from "../types";
import { Teardrop } from "../Teardrop";

interface PartMeshProps {
  part: PlacedPart;
  slotPosition: [number, number, number];
  selected: boolean;
  onClick: () => void;
}

interface PartGeometryProps {
  meshId: string;
  slotId: string;
  color: string;
  emissive: string;
}

/** Renders a single body part geometry by preset id */
function PartGeometry({ meshId, slotId, color, emissive }: PartGeometryProps) {
  // const teardropRotation = getTeardropRotation(meshId, slotId);
  // const teardropOffset = getTeardropOffset(meshId, slotId);

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
        </mesh>
      );
    case "body-teardrop":
      return (
        <group
          position={[0, -0.2, 0]}
          rotation={[0, 0, 0]}
          scale={[1.6, 1.5, 1.6]}
        >
          <Teardrop color={color} emissive={emissive} />
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
        </mesh>
      );
    case "limb-teardrop":
      return (
        <group
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          scale={[0.75, 0.75, 0.75]}
        >
          <Teardrop color={color} emissive={emissive} />
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
        </mesh>
      );
    case "ear-teardrop":
      return (
        <group
          position={[0, 0, 0]}
          rotation={[Math.PI, 0, 0]}
          scale={[0.5, 0.36, 0.1]}
        >
          <Teardrop color={color} emissive={emissive} />
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
        </mesh>
      );
  }
}

export function PartMesh({
  part,
  slotPosition,
  selected,
  onClick,
}: PartMeshProps) {
  const emissive = selected ? "#333333" : "#000000";

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
      <PartGeometry
        meshId={part.meshId}
        slotId={part.slotId}
        color={part.color}
        emissive={emissive}
      />
    </group>
  );
}
