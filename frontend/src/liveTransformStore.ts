/** Module-level signal for real-time transform values during drag.
 *  Writes from PartMesh (Three.js world), reads in ColorPopup (DOM).
 *  Deliberately NOT React state so PartMesh never re-renders during drag.
 */
type Listener = (sx: number, sy: number, sz: number) => void;

let _sx = 1, _sy = 1, _sz = 1;
const listeners = new Set<Listener>();

export function setLiveScale(x: number, y: number, z: number) {
  _sx = x; _sy = y; _sz = z;
  listeners.forEach((fn) => fn(x, y, z));
}

export function getLiveScale() {
  return { x: _sx, y: _sy, z: _sz };
}

export function resetLiveScale(x: number, y: number = x, z: number = x) {
  _sx = x; _sy = y; _sz = z;
  listeners.forEach((fn) => fn(x, y, z));
}

export function subscribeLiveScale(fn: Listener) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
