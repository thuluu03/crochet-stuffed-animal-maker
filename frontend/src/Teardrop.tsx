import { Outlines } from "@react-three/drei";

interface TeardropProps {
  color?: string;
  emissive?: string;
  showOutline?: boolean;
}

export function Teardrop({
  color = "#9fd0ea",
  emissive = "#000000",
  showOutline = false,
}: TeardropProps) {
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
        {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
      </mesh>

      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          roughness={0.8}
          metalness={0.1}
        />
        {showOutline && <Outlines thickness={0.03} color="#4fc3f7" />}
      </mesh>
    </group>
  );
}
