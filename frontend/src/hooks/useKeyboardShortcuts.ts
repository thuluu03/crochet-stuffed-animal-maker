import { useEffect, useRef } from "react";
import { useDesign } from "../designStore";
import { setTransformMode } from "../transformModeStore";
import type { PlacedPart } from "../types";


function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || tag === "select" || (el as HTMLElement).isContentEditable;
}

function newId(): string {
  return "part-" + Math.random().toString(36).slice(2, 11);
}

export function useKeyboardShortcuts() {
  const { selectedInstanceId, getPart, removePart, insertPart, setSelected, undo } = useDesign();
  const clipboardRef = useRef<PlacedPart | null>(null);

  // Keep a stable ref to current selectedInstanceId so the handler closure doesn't go stale.
  const selectedRef = useRef(selectedInstanceId);
  selectedRef.current = selectedInstanceId;

  const getPartRef = useRef(getPart);
  getPartRef.current = getPart;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const meta = e.ctrlKey || e.metaKey;

      if (meta && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      if (meta && e.key === "c") {
        const part = selectedRef.current ? getPartRef.current(selectedRef.current) : null;
        if (part) clipboardRef.current = part;
        return;
      }

      if (meta && e.key === "v") {
        if (clipboardRef.current) {
          e.preventDefault();
          insertPart({ ...clipboardRef.current, instanceId: newId() }, true);
        }
        return;
      }

      // Non-modifier shortcuts — skip when user is typing in an input.
      if (isInputFocused()) return;

      if (e.key === "t" || e.key === "T") { setTransformMode("translate"); return; }
      if (e.key === "r" || e.key === "R") { setTransformMode("rotate"); return; }
      if (e.key === "s" || e.key === "S") { setTransformMode("scale"); return; }

      if (e.key === "Escape") { setSelected(null); return; }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedRef.current) {
          e.preventDefault();
          removePart(selectedRef.current);
        }
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, insertPart, removePart, setSelected]);
}
