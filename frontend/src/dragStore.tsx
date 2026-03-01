import { createContext, useCallback, useContext, useState } from "react";

interface DragState {
  dragData: { meshId: string; slotKind: string } | null;
  setDragData: (d: { meshId: string; slotKind: string } | null) => void;
}

const DragContext = createContext<DragState | null>(null);

export function DragProvider({ children }: { children: React.ReactNode }) {
  const [dragData, setDragData] = useState<{ meshId: string; slotKind: string } | null>(null);
  const value: DragState = { dragData, setDragData };
  return <DragContext.Provider value={value}>{children}</DragContext.Provider>;
}

export function useDrag() {
  const ctx = useContext(DragContext);
  if (!ctx) return { dragData: null, setDragData: () => {} };
  return ctx;
}
