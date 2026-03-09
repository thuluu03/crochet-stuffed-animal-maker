export type TransformMode = "translate" | "rotate" | "scale";

let _mode: TransformMode = "scale";
const listeners = new Set<(m: TransformMode) => void>();

export function getTransformMode(): TransformMode { return _mode; }

export function setTransformMode(m: TransformMode) {
  _mode = m;
  listeners.forEach((fn) => fn(m));
}

export function subscribeTransformMode(fn: (m: TransformMode) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
