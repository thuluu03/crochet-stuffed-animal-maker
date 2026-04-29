import type {
  DesignPayload,
  FileUploadResponse,
  MeshListResponse,
  SketchInferenceRequest,
  SketchInferenceResponse,
} from "./types";

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

/** Fetches generated crochet instructions and triggers a file download in the browser. */
export async function downloadCrochetPattern(designId: string, fallbackName?: string): Promise<void> {
  const res = await fetch(`${API_BASE}/api/designs/${encodeURIComponent(designId)}/pattern`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition");
  let filename = `crochet-pattern-${designId}.txt`;
  if (fallbackName?.trim()) {
    const stem = fallbackName.trim().replace(/[^\w\s-]/g, "").replace(/\s+/g, "-").slice(0, 60);
    if (stem.length > 0) filename = `${stem}-crochet-pattern.txt`;
  }
  const m = cd?.match(/filename="([^"]+)"/);
  if (m?.[1]) filename = m[1];
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function listSketches(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/sketches`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as { sketches?: string[] };
  return body.sketches ?? [];
}

export async function inferSketchParts(payload: SketchInferenceRequest): Promise<SketchInferenceResponse> {
  const res = await fetch(`${API_BASE}/api/sketches/infer-parts`, {
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

async function uploadFile(endpoint: string, file: File): Promise<FileUploadResponse> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export function uploadSketch(file: File): Promise<FileUploadResponse> {
  return uploadFile("/api/sketches/upload", file);
}

export function uploadMesh(file: File): Promise<FileUploadResponse> {
  return uploadFile("/api/meshes/upload", file);
}

export async function listMeshes(): Promise<string[]> {
  const res = await fetch(`${API_BASE}/api/meshes`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  const body = (await res.json()) as MeshListResponse;
  return body.meshes ?? [];
}

export function getMeshUrl(filename: string): string {
  return `${API_BASE}/api/meshes/${encodeURIComponent(filename)}`;
}
