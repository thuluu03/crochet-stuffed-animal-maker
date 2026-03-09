/** Module-level signal for real-time transform values during drag.
 *  Writes from PartMesh (Three.js world), reads in ColorPopup (DOM).
 *  Deliberately NOT React state so PartMesh never re-renders during drag.
 */
export interface LiveVec3 { x: number; y: number; z: number; }
type Listener = (scale: LiveVec3, position: LiveVec3, rotation: LiveVec3) => void;

let _scale: LiveVec3 = { x: 1, y: 1, z: 1 };
let _position: LiveVec3 = { x: 0, y: 0, z: 0 };
let _rotation: LiveVec3 = { x: 0, y: 0, z: 0 };
const listeners = new Set<Listener>();

function notify() {
  listeners.forEach((fn) => fn({ ..._scale }, { ..._position }, { ..._rotation }));
}

export function setLiveScale(x: number, y: number, z: number) {
  _scale = { x, y, z };
  notify();
}

export function setLivePosition(x: number, y: number, z: number) {
  _position = { x, y, z };
  notify();
}

export function setLiveRotation(x: number, y: number, z: number) {
  _rotation = { x, y, z };
  notify();
}

export function getLiveTransform() {
  return { scale: { ..._scale }, position: { ..._position }, rotation: { ..._rotation } };
}

export function resetLiveTransform(
  scale: LiveVec3 = _scale,
  position: LiveVec3 = { x: 0, y: 0, z: 0 },
  rotation: LiveVec3 = { x: 0, y: 0, z: 0 },
) {
  _scale = scale;
  _position = position;
  _rotation = rotation;
  notify();
}

/** Convenience — kept for call-sites that only need scale reset */
export function resetLiveScale(x: number, y: number = x, z: number = x) {
  _scale = { x, y, z };
  _position = { x: 0, y: 0, z: 0 };
  _rotation = { x: 0, y: 0, z: 0 };
  notify();
}

export function subscribeLiveTransform(fn: Listener) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
