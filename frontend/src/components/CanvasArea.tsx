import { useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Scene, type PendingDrop } from "./Scene";
import { DRAG_TYPE } from "./Sidebar";
import { useDrag } from "../dragStore";

export function CanvasArea() {
  const [pendingDrop, setPendingDrop] = useState<PendingDrop | null>(null);
  const { dragData, setDragData } = useDrag();

  const clearPendingDrop = useCallback(() => setPendingDrop(null), []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const raw = e.dataTransfer.getData(DRAG_TYPE);
      if (!raw) return;
      try {
        const { meshId, slotKind } = JSON.parse(raw);
        setPendingDrop({
          meshId,
          slotKind,
          clientX: e.clientX,
          clientY: e.clientY,
        });
      } catch {
        // ignore
      }
      setDragData(null);
    },
    [setDragData]
  );

  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setDragData(null);
      }
    },
    [setDragData]
  );

  return (
    <div
      className="canvas-area"
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragLeave={onDragLeave}
    >
      <Canvas
        shadows
        camera={{ position: [0, 1.15, 4.2], fov: 40 }}
        gl={{ antialias: true }}
      >
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.05}
          target={[0, 1.15, 0]}
        />
        <Scene
          pendingDrop={pendingDrop}
          clearPendingDrop={clearPendingDrop}
          dragData={dragData}
          setDragData={setDragData}
        />
      </Canvas>
      {dragData && (
        <div className="drop-hint">Drop on a highlighted slot to attach the part</div>
      )}
    </div>
  );
}
