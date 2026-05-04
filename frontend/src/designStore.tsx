import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PlacedPart, DesignPayload, SketchPlacedPart } from "./types";
import { MANNEQUIN_SLOTS } from "./presets";
import { computePatternRowCount } from "./patternRowCount";

interface DesignState {
  parts: PlacedPart[];
  selectedInstanceId: string | null;
  setSelected: (id: string | null) => void;
  addPart: (meshId: string, slotId: string) => void;
  removePart: (instanceId: string) => void;
  updatePart: (instanceId: string, updates: Partial<PlacedPart>) => void;
  insertPart: (part: PlacedPart, select?: boolean) => void;
  getPart: (instanceId: string) => PlacedPart | undefined;
  getPartsBySlot: (slotId: string) => PlacedPart[];
  usedSlots: Set<string>;
  buildPayload: (finalizedMeshes: DesignPayload["finalizedMeshes"]) => DesignPayload;
  applyInferredParts: (inferredParts: SketchPlacedPart[]) => void;
  loadSavedDesignParts: (parts: DesignPayload["parts"]) => void;
  clearCanvas: () => void;
  undo: () => void;
  canUndo: boolean;
}

function nextId(): string {
  return "part-" + Math.random().toString(36).slice(2, 11);
}

function defaultScale(slotId: string): [number, number, number] {
  if (slotId === "leftLeg" || slotId === "rightLeg") {
    return [1, 0.88, 1];
  }
  return [1, 1, 1];
}

function defaultRotation(
  meshId: string,
  slotId: string,
  slotRotation: [number, number, number]
): [number, number, number] {
  if (meshId === "limb-teardrop" && (slotId === "leftLeg" || slotId === "rightLeg")) {
    return [0, 0, Math.PI];
  }
  return slotRotation;
}

const DesignContext = createContext<DesignState | null>(null);

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [parts, setParts] = useState<PlacedPart[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [history, setHistory] = useState<PlacedPart[][]>([]);

  const pushHistory = useCallback((snapshot: PlacedPart[]) => {
    setHistory((h) => [...h.slice(-29), snapshot]);
  }, []);

  const usedSlots = useMemo(() => new Set(parts.map((p) => p.slotId)), [parts]);

  const addPart = useCallback((meshId: string, slotId: string) => {
    const slot = MANNEQUIN_SLOTS.find((s) => s.id === slotId);
    if (!slot) return;
    setParts((prev) => {
      pushHistory(prev);
      const part: PlacedPart = {
        instanceId: nextId(),
        meshId,
        slotId,
        position: [0, 0, 0],
        scale: defaultScale(slotId),
        rotation: defaultRotation(meshId, slotId, slot.rotation),
        color: "#c4a574",
      };
      return [...prev.filter((p) => p.slotId !== slotId), part];
    });
    setSelectedInstanceId(null);
  }, [pushHistory]);

  const removePart = useCallback((instanceId: string) => {
    setParts((prev) => { pushHistory(prev); return prev.filter((p) => p.instanceId !== instanceId); });
    setSelectedInstanceId((id) => (id === instanceId ? null : id));
  }, [pushHistory]);

  const updatePart = useCallback((instanceId: string, updates: Partial<PlacedPart>) => {
    setParts((prev) => {
      pushHistory(prev);
      return prev.map((p) => {
        if (p.instanceId !== instanceId) return p;
        // When scale changes without an explicit rowColors override, remap existing
        // rowColors proportionally so colors stay at the same visual position.
        if (updates.scale && !("rowColors" in updates) && p.rowColors && Object.keys(p.rowColors).length > 0) {
          const oldCount = computePatternRowCount(p.meshId, p.scale);
          const newCount = computePatternRowCount(p.meshId, updates.scale);
          if (oldCount !== newCount && oldCount > 0 && newCount > 0) {
            const remapped: Record<number, string> = {};
            for (const [key, color] of Object.entries(p.rowColors)) {
              const newIdx = Math.min(newCount - 1, Math.max(0, Math.round((parseInt(key) * newCount) / oldCount)));
              remapped[newIdx] = color;
            }
            return { ...p, ...updates, rowColors: remapped };
          }
        }
        return { ...p, ...updates };
      });
    });
  }, [pushHistory]);

  const insertPart = useCallback((part: PlacedPart, select = false) => {
    setParts((prev) => {
      pushHistory(prev);
      return [...prev.filter((p) => p.slotId !== part.slotId), part];
    });
    if (select) setSelectedInstanceId(part.instanceId);
  }, [pushHistory]);

  const undo = useCallback(() => {
    setHistory((h) => {
      if (h.length === 0) return h;
      const prev = h[h.length - 1];
      setParts(prev);
      return h.slice(0, -1);
    });
    setSelectedInstanceId(null);
  }, []);

  const getPart = useCallback(
    (instanceId: string) => parts.find((p) => p.instanceId === instanceId),
    [parts]
  );

  const getPartsBySlot = useCallback(
    (slotId: string) => parts.filter((p) => p.slotId === slotId),
    [parts]
  );

  const buildPayload = useCallback(
    (finalizedMeshes: DesignPayload["finalizedMeshes"]): DesignPayload => ({
      name: "My stuffed animal",
      parts: parts.map((p) => ({
        meshId: p.meshId,
        slotId: p.slotId,
        position: { x: p.position[0], y: p.position[1], z: p.position[2] },
        scale: { x: p.scale[0], y: p.scale[1], z: p.scale[2] },
        rotation: { x: p.rotation[0], y: p.rotation[1], z: p.rotation[2] },
        color: p.color,
        rowColors: p.rowColors,
      })),
      finalizedMeshes,
    }),
    [parts]
  );

  const applyInferredParts = useCallback((inferredParts: SketchPlacedPart[]) => {
    setParts((prev) => {
      pushHistory(prev);
      return inferredParts.map((part) => ({
        instanceId: nextId(),
        meshId: part.meshId,
        slotId: part.slotId,
        position: [part.position.x, part.position.y, part.position.z] as [number, number, number],
        scale: [part.scale.x, part.scale.y, part.scale.z] as [number, number, number],
        rotation: [part.rotation.x, part.rotation.y, part.rotation.z] as [number, number, number],
        color: part.color,
      }));
    });
    setSelectedInstanceId(null);
  }, [pushHistory]);

  const loadSavedDesignParts = useCallback((savedParts: DesignPayload["parts"]) => {
    setParts((prev) => {
      pushHistory(prev);
      return savedParts.map((part) => ({
        instanceId: nextId(),
        meshId: part.meshId,
        slotId: part.slotId,
        position: [part.position.x, part.position.y, part.position.z] as [number, number, number],
        scale: [part.scale.x, part.scale.y, part.scale.z] as [number, number, number],
        rotation: [part.rotation.x, part.rotation.y, part.rotation.z] as [number, number, number],
        color: part.color,
        rowColors: part.rowColors,
      }));
    });
    setSelectedInstanceId(null);
  }, [pushHistory]);

  const clearCanvas = useCallback(() => {
    setParts((prev) => { pushHistory(prev); return []; });
    setSelectedInstanceId(null);
  }, [pushHistory]);

  const value: DesignState = useMemo(
    () => ({
      parts,
      selectedInstanceId,
      setSelected: setSelectedInstanceId,
      addPart,
      removePart,
      updatePart,
      insertPart,
      getPart,
      getPartsBySlot,
      usedSlots,
      buildPayload,
      applyInferredParts,
      loadSavedDesignParts,
      clearCanvas,
      undo,
      canUndo: history.length > 0,
    }),
    [
      parts,
      selectedInstanceId,
      addPart,
      removePart,
      updatePart,
      insertPart,
      getPart,
      getPartsBySlot,
      usedSlots,
      buildPayload,
      applyInferredParts,
      loadSavedDesignParts,
      clearCanvas,
      undo,
      history.length,
    ]
  );

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign must be used within DesignProvider");
  return ctx;
}
