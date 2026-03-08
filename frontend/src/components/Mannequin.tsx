import { useRef } from "react";
import { useDesign } from "../designStore";
import { MANNEQUIN_SLOTS } from "../presets";
import { PartMesh } from "./PartMesh";

/** Simple torso and slot hit areas for drop detection */
export function MannequinBody() {
  const { usedSlots } = useDesign();

  return (
    <group>
      {/* Left ear */}
      {!usedSlots.has("leftEar") && (
        <mesh position={[-0.18, 0.96, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.1, 18, 14]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Right ear */}
      {!usedSlots.has("rightEar") && (
        <mesh position={[0.18, 0.96, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.1, 18, 14]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Body */}
      {!usedSlots.has("body") && (
        <mesh position={[0, 0, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.34, 0.4, 0.82, 28]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Head */}
      {!usedSlots.has("head") && (
        <mesh position={[0, 0.62, 0]} castShadow receiveShadow>
          <sphereGeometry args={[0.28, 28, 20]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Left arm */}
      {!usedSlots.has("leftArm") && (
        <mesh
          position={[-0.5, 0, 0]}
          rotation={[0, 0, Math.PI / 1.35]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.08, 0.08, 0.6, 18]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Right arm */}
      {!usedSlots.has("rightArm") && (
        <mesh
          position={[0.5, 0, 0]}
          rotation={[0, 0, -Math.PI / 1.35]}
          castShadow
          receiveShadow
        >
          <cylinderGeometry args={[0.08, 0.08, 0.6, 18]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Left leg */}
      {!usedSlots.has("leftLeg") && (
        <mesh position={[-0.16, -0.64, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.48, 18]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
      {/* Right leg */}
      {!usedSlots.has("rightLeg") && (
        <mesh position={[0.16, -0.64, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.09, 0.09, 0.48, 18]} />
          <meshStandardMaterial
            color="#e8dcc8"
            roughness={0.9}
            metalness={0}
            transparent
            opacity={0.22}
          />
        </mesh>
      )}
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
  const { parts, setSelected, selectedInstanceId, updatePart } = useDesign();

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
            selected={selectedInstanceId === part.instanceId}
            onClick={() => setSelected(part.instanceId)}
            onHover={() => {}}
            onScaleChange={(scale: [number, number, number]) => updatePart(part.instanceId, { scale })}
          />
        );
      })}
    </>
  );
}
