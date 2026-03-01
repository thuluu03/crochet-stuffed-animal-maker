import type { DesignPayload } from "./types";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export async function saveDesign(payload: DesignPayload): Promise<{ id: string; name?: string }> {
  const res = await fetch(`${API_BASE}/api/designs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export async function listDesigns(): Promise<{ id: string; name?: string; updatedAt: string }[]> {
  const res = await fetch(`${API_BASE}/api/designs`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export async function getDesign(id: string): Promise<DesignPayload & { id: string; createdAt: string; updatedAt: string }> {
  const res = await fetch(`${API_BASE}/api/designs/${id}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
