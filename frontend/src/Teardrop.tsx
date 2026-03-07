interface TeardropProps {
  color?: string;
  emissive?: string;
}

export function Teardrop({
  color = "#9fd0ea",
  emissive = "#000000",
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
      </mesh>

      <mesh position={[0, 0, 0]} castShadow receiveShadow>
        <sphereGeometry args={[0.18, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissive}
          roughness={0.8}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}
