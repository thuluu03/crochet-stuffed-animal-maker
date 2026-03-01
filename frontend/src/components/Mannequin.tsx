import { useRef } from "react";
import { useDesign } from "../designStore";
import { MANNEQUIN_SLOTS } from "../presets";
import { PartMesh } from "./PartMesh";

/** Simple torso and slot hit areas for drop detection */
export function MannequinBody() {
  return (
    <group>
      {/* Torso */}
      <mesh position={[0, 1.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.35, 0.4, 0.6, 24]} />
        <meshStandardMaterial color="#8b7355" roughness={0.9} metalness={0} />
      </mesh>
      {/* Neck stump */}
      <mesh position={[0, 1.6, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.25, 0.2, 16]} />
        <meshStandardMaterial color="#8b7355" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  );
}

/** Invisible hit boxes for each slot (for raycast on drop) */
export function SlotHitBoxes({
  onSlotHover,
  onSlotDrop,
  dragData,
}: {
  onSlotHover: (slotId: string | null) => void;
  onSlotDrop: (slotId: string, meshId: string) => void;
  dragData: { meshId: string; slotKind: string } | null;
}) {
  const hoveredSlot = useRef<string | null>(null);

  return (
    <group>
      {MANNEQUIN_SLOTS.map((slot) => {
        const canAccept = dragData && slot.accepts.includes(dragData.slotKind);
        return (
          <mesh
            key={slot.id}
            position={slot.position}
            rotation={slot.rotation}
            visible={false}
            onPointerOver={(e) => {
              e.stopPropagation();
              hoveredSlot.current = slot.id;
              onSlotHover(slot.id);
            }}
            onPointerOut={() => {
              hoveredSlot.current = null;
              onSlotHover(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (dragData && canAccept) {
                onSlotDrop(slot.id, dragData.meshId);
              }
            }}
          >
            <sphereGeometry args={[0.4, 8, 6]} />
          </mesh>
        );
      })}
    </group>
  );
}

/** Renders all placed parts */
export function MannequinParts() {
  const { parts, setSelected, getPart, selectedInstanceId } = useDesign();

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
