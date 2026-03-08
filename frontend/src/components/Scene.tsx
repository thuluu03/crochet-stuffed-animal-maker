import { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useDesign } from "../designStore";
import { MannequinBody, MannequinParts } from "./Mannequin";
import { MANNEQUIN_SLOTS } from "../presets";

export interface PendingDrop {
  meshId: string;
  slotKind: string;
  clientX: number;
  clientY: number;
}

interface SceneProps {
  pendingDrop: PendingDrop | null;
  clearPendingDrop: () => void;
  dragData: { meshId: string; slotKind: string } | null;
  setDragData: (d: { meshId: string; slotKind: string } | null) => void;
}

function getSlotHitRadius(slotId: string): number {
  if (slotId === "body") return 0.95;
  if (slotId === "head") return 0.72;
  if (slotId === "leftArm" || slotId === "rightArm") return 0.72;
  if (slotId === "leftLeg" || slotId === "rightLeg") return 0.68;
  if (slotId === "leftEar" || slotId === "rightEar") return 0.55;
  if (slotId === "tail") return 0.5;
  return 0.6;
}

export function Scene({
  pendingDrop,
  clearPendingDrop,
  dragData,
  setDragData,
}: SceneProps) {
  const { addPart } = useDesign();
  const handleSlotDrop = useCallback(
    (slotId: string, meshId: string) => {
      addPart(meshId, slotId);
      setDragData(null);
    },
    [addPart, setDragData],
  );

  // Raycast on drop to find which slot was hit (process only once per drop)
  const processedDropRef = useRef(false);
  useFrame((state) => {
    if (!pendingDrop) {
      processedDropRef.current = false;
      return;
    }
    if (processedDropRef.current) return;
    processedDropRef.current = true;
    clearPendingDrop();
    const { camera, gl } = state;
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((pendingDrop.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((pendingDrop.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.layers.set(0);
    raycaster.layers.enable(1);
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);
    const scene = state.scene;
    const allMeshes: THREE.Object3D[] = [];
    scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.name.startsWith("slot-")) {
        allMeshes.push(obj);
      }
    });
    const hits = raycaster.intersectObjects(allMeshes, true);
    if (hits.length > 0) {
      const matchingHit = hits.find((hit) => {
        const slotId = (hit.object as THREE.Mesh).name.replace("slot-", "");
        const slot = MANNEQUIN_SLOTS.find((s) => s.id === slotId);
        return slot && slot.accepts.includes(pendingDrop.slotKind);
      });

      if (matchingHit) {
        const slotId = (matchingHit.object as THREE.Mesh).name.replace(
          "slot-",
          "",
        );
        addPart(pendingDrop.meshId, slotId);
      }
    }
  });

  // When not dragging, only raycast layer 0 so parts receive hover; slots are on layer 1
  useFrame((state) => {
    if (!dragData) {
      state.raycaster.layers.set(0);
    } else {
      state.raycaster.layers.set(0);
      state.raycaster.layers.enable(1);
    }
  });

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[5, 8, 5]}
        intensity={1}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <MannequinBody />
      <MannequinParts />

      {/* Slot meshes on layer 1 so they don't steal pointer from parts; drop raycast enables layer 1 */}
      <group>
        {MANNEQUIN_SLOTS.map((slot) => (
          <mesh
            key={slot.id}
            name={`slot-${slot.id}`}
            position={slot.position}
            rotation={slot.rotation}
            visible={false}
            ref={(r) => {
              if (r) r.layers.set(1);
            }}
            onPointerOver={(e) => {
              e.stopPropagation();
            }}
            onClick={() => {
              if (dragData && slot.accepts.includes(dragData.slotKind)) {
                handleSlotDrop(slot.id, dragData.meshId);
              }
            }}
          >
            <sphereGeometry args={[getSlotHitRadius(slot.id), 10, 8]} />
          </mesh>
        ))}
      </group>

    </>
  );
}
