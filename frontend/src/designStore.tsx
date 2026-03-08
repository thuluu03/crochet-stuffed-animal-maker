import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { PlacedPart, DesignPayload } from "./types";
import { MANNEQUIN_SLOTS } from "./presets";

interface DesignState {
  parts: PlacedPart[];
  selectedInstanceId: string | null;
  setSelected: (id: string | null) => void;
  addPart: (meshId: string, slotId: string) => void;
  removePart: (instanceId: string) => void;
  updatePart: (instanceId: string, updates: Partial<PlacedPart>) => void;
  getPart: (instanceId: string) => PlacedPart | undefined;
  getPartsBySlot: (slotId: string) => PlacedPart[];
  usedSlots: Set<string>;
  buildPayload: (finalizedMeshes: DesignPayload["finalizedMeshes"]) => DesignPayload;
}

function nextId(): string {
  return "part-" + Math.random().toString(36).slice(2, 11);
}

const DesignContext = createContext<DesignState | null>(null);

export function DesignProvider({ children }: { children: React.ReactNode }) {
  const [parts, setParts] = useState<PlacedPart[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);

  const usedSlots = useMemo(() => new Set(parts.map((p) => p.slotId)), [parts]);

  const addPart = useCallback((meshId: string, slotId: string) => {
    const slot = MANNEQUIN_SLOTS.find((s) => s.id === slotId);
    if (!slot) return;
    setParts((prev) => {
      const part: PlacedPart = {
        instanceId: nextId(),
        meshId,
        slotId,
        position: [0, 0, 0],
        scale: [1, 1, 1] as [number, number, number],
        rotation: slot.rotation,
        color: "#c4a574",
      };
      return [...prev.filter((p) => p.slotId !== slotId), part];
    });
    setSelectedInstanceId(null);
  }, []);

  const removePart = useCallback((instanceId: string) => {
    setParts((prev) => prev.filter((p) => p.instanceId !== instanceId));
    setSelectedInstanceId((id) => (id === instanceId ? null : id));
  }, []);

  const updatePart = useCallback((instanceId: string, updates: Partial<PlacedPart>) => {
    setParts((prev) =>
      prev.map((p) => (p.instanceId === instanceId ? { ...p, ...updates } : p))
    );
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
        scale: (p.scale[0] + p.scale[1] + p.scale[2]) / 3,
        rotation: { x: p.rotation[0], y: p.rotation[1], z: p.rotation[2] },
        color: p.color,
        rowColors: p.rowColors,
      })),
      finalizedMeshes,
    }),
    [parts]
  );

  const value: DesignState = useMemo(
    () => ({
      parts,
      selectedInstanceId,
      setSelected: setSelectedInstanceId,
      addPart,
      removePart,
      updatePart,
      getPart,
      getPartsBySlot,
      usedSlots,
      buildPayload,
    }),
    [
      parts,
      selectedInstanceId,
      addPart,
      removePart,
      updatePart,
      getPart,
      getPartsBySlot,
      usedSlots,
      buildPayload,
    ]
  );

  return <DesignContext.Provider value={value}>{children}</DesignContext.Provider>;
}

export function useDesign() {
  const ctx = useContext(DesignContext);
  if (!ctx) throw new Error("useDesign must be used within DesignProvider");
  return ctx;
}
