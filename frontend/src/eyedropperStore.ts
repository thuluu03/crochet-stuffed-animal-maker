type PickCallback = (color: string) => void;

let pending: PickCallback | null = null;
const listeners = new Set<(active: boolean) => void>();

export function activateEyedropper(cb: PickCallback) {
  pending = cb;
  document.body.classList.add("eyedropper-active");
  listeners.forEach((fn) => fn(true));
}

export function deactivateEyedropper() {
  pending = null;
  document.body.classList.remove("eyedropper-active");
  listeners.forEach((fn) => fn(false));
}

export function isEyedropperActive(): boolean {
  return pending !== null;
}

export function pickEyedropperColor(color: string) {
  if (!pending) return;
  pending(color);
  pending = null;
  document.body.classList.remove("eyedropper-active");
  listeners.forEach((fn) => fn(false));
}

export function subscribeEyedropper(fn: (active: boolean) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
