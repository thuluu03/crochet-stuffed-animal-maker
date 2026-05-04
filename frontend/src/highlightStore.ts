type HighlightState = { instanceId: string | null; segments: number[] };

let state: HighlightState = { instanceId: null, segments: [] };
const listeners = new Set<(s: HighlightState) => void>();

function emit() {
  listeners.forEach((l) => l(state));
}

export function setHighlight(instanceId: string, segments: number[]) {
  state = { instanceId, segments };
  emit();
}

export function clearHighlight() {
  if (state.instanceId === null) return;
  state = { instanceId: null, segments: [] };
  emit();
}

export function getHighlight() {
  return state;
}

export function subscribeHighlight(fn: (s: HighlightState) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
