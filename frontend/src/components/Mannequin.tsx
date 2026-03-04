import { useDesign } from "../designStore";
import { MANNEQUIN_SLOTS } from "../presets";
import { PartMesh } from "./PartMesh";
import * as THREE from "three";

/** Transparent torso and neck for drop detection / reference */
export function MannequinBody() {
  return (
    <group>
      {/* Torso */}
      <mesh position={[0, 1.2, 0]} castShadow={false} receiveShadow={false}>
        <cylinderGeometry args={[0.35, 0.4, 0.6, 24]} />
        <meshStandardMaterial
          color="#cfd6e3"
          metalness={0}
          roughness={1}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
      {/* Neck stump */}
      <mesh position={[0, 1.6, 0]} castShadow={false}>
        <cylinderGeometry args={[0.2, 0.25, 0.2, 16]} />
        <meshStandardMaterial
          color="#cfd6e3"
          metalness={0}
          roughness={1}
          transparent
          opacity={0.15}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

const SLOT_SPHERE_RADIUS = 0.45;
const SLOT_SPHERE_SEGS: [number, number] = [16, 12];

/** Shared edge geometry for slot outlines */
const slotEdgesGeometry = new THREE.EdgesGeometry(
  new THREE.SphereGeometry(SLOT_SPHERE_RADIUS, SLOT_SPHERE_SEGS[0], SLOT_SPHERE_SEGS[1]),
  12
);

/** Hit boxes: transparent fill with solid outline (for raycast and click) */
export function SlotHitBoxes({
  onSlotDrop,
  dragData,
}: {
  onSlotDrop: (slotId: string, meshId: string) => void;
  dragData: { meshId: string; slotKind: string } | null;
}) {
  return (
    <group>
      {MANNEQUIN_SLOTS.map((slot) => {
        const canAccept = dragData && slot.accepts.includes(dragData.slotKind);
        const outlineColor = canAccept ? "#4fc3f7" : "#78909c";
        return (
          <group
            key={slot.id}
            position={slot.position}
            rotation={slot.rotation}
            onPointerOver={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              if (dragData && canAccept) {
                onSlotDrop(slot.id, dragData.meshId);
              }
            }}
          >
            <mesh name={`slot-${slot.id}`}>
              <sphereGeometry args={[SLOT_SPHERE_RADIUS, SLOT_SPHERE_SEGS[0], SLOT_SPHERE_SEGS[1]]} />
              <meshBasicMaterial
                transparent
                opacity={0.2}
                depthWrite={false}
                color="#607d8b"
              />
            </mesh>
            <lineSegments geometry={slotEdgesGeometry}>
              <lineBasicMaterial color={outlineColor} />
            </lineSegments>
          </group>
        );
      })}
    </group>
  );
}

/** Renders all placed parts */
export function MannequinParts() {
  const { parts, setSelected, selectedInstanceId } = useDesign();

  return (
    <>
      {parts.map((part) => {
        const slot = MANNEQUIN_SLOTS.find((s) => s.id === part.slotId);
        if (!slot) return null;
        return (
          <PartMesh
            key={part.instanceId}
            part={part}
            slotPosition={slot.position}
            slotRotation={slot.rotation}
            selected={selectedInstanceId === part.instanceId}
            onClick={() => setSelected(part.instanceId)}
          />
        );
      })}
    </>
  );
}
