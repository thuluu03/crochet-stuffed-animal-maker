import { useRef, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { TransformControls } from "@react-three/drei";
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

export function Scene({
  pendingDrop,
  clearPendingDrop,
  dragData,
  setDragData,
}: SceneProps) {
  const { addPart, selectedInstanceId, updatePart, getPart } = useDesign();

  const handleSlotDrop = useCallback(
    (slotId: string, meshId: string) => {
      addPart(meshId, slotId);
      setDragData(null);
    },
    [addPart, setDragData]
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
      const hit = hits[0];
      const slotId = (hit.object as THREE.Mesh).name.replace("slot-", "");
      const slot = MANNEQUIN_SLOTS.find((s) => s.id === slotId);
      if (slot && slot.accepts.includes(pendingDrop.slotKind)) {
        addPart(pendingDrop.meshId, slotId);
      }
    }
  });

  const selectedPart = selectedInstanceId ? getPart(selectedInstanceId) : null;

  return (
    <>
      <ambientLight intensity={0.6} />
      <directionalLight position={[5, 8, 5]} intensity={1} castShadow shadow-mapSize={[1024, 1024]} />
      <MannequinBody />
      <MannequinParts />

      {/* Invisible slot meshes for raycast (drop and hover) - named for raycast */}
      <group>
        {MANNEQUIN_SLOTS.map((slot) => (
          <mesh
            key={slot.id}
            name={`slot-${slot.id}`}
            position={slot.position}
            rotation={slot.rotation}
            visible={false}
            onPointerOver={(e) => {
              e.stopPropagation();
            }}
            onClick={(e) => {
              e.stopPropagation();
              if (dragData && slot.accepts.includes(dragData.slotKind)) {
                handleSlotDrop(slot.id, dragData.meshId);
              }
            }}
          >
            <sphereGeometry args={[0.45, 8, 6]} />
          </mesh>
        ))}
      </group>

      {selectedPart && (() => {
        const slot = MANNEQUIN_SLOTS.find((s) => s.id === selectedPart.slotId);
        if (!slot) return null;
        const pos: [number, number, number] = [
          slot.position[0] + selectedPart.position[0],
          slot.position[1] + selectedPart.position[1],
          slot.position[2] + selectedPart.position[2],
        ];
        return (
          <TransformControls
            mode="scale"
            size={0.5}
            onObjectChange={(e) => {
              if (!e.target.object || !selectedInstanceId) return;
              const t = e.target.object as THREE.Object3D;
              const s = (t.scale.x + t.scale.y + t.scale.z) / 3;
              updatePart(selectedInstanceId, { scale: Math.max(0.2, Math.min(3, s)) });
            }}
          >
            <group position={pos} scale={[selectedPart.scale, selectedPart.scale, selectedPart.scale]} />
          </TransformControls>
        );
      })()}
    </>
  );
}
