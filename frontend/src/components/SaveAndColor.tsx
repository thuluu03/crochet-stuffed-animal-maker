import { useState } from "react";
import { useDesign } from "../designStore";
import { saveDesign } from "../api";

export function SaveAndColor() {
  const {
    parts,
    buildPayload,
  } = useDesign();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [designName, setDesignName] = useState("My stuffed animal");

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const finalizedMeshes = parts.map((p) => ({
        partInstanceId: p.instanceId,
        meshId: p.meshId,
        slotId: p.slotId,
        points: [] as number[],
        indices: [] as number[],
        colors: [p.color],
        rowMapping: p.rowColors ? { 0: [] } : undefined,
      }));
      const payload = buildPayload(finalizedMeshes);
      payload.name = designName;
      const result = await saveDesign(payload);
      setMessage(`Saved as ${result.id}`);
    } catch (e) {
      setMessage(
        "Save failed: " + (e instanceof Error ? e.message : String(e)),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="save-and-color">
      <div className="tool-row">
        <input
          type="text"
          className="design-name"
          value={designName}
          onChange={(e) => setDesignName(e.target.value)}
          placeholder="Design name"
        />
        <button
          type="button"
          className="save-btn"
          onClick={handleSave}
          disabled={saving || parts.length === 0}
        >
          {saving ? "Saving…" : "Save design"}
        </button>
      </div>
      {message && <p className="message">{message}</p>}
    </div>
  );
}
