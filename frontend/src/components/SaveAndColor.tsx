import { useState } from "react";
import { useDesign } from "../designStore";
import { saveDesign } from "../api";

const ROW_COUNT = 5; // Optional: number of "rows" for stitch coloring

export function SaveAndColor() {
  const { parts, selectedInstanceId, getPart, updatePart, removePart, buildPayload } = useDesign();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [designName, setDesignName] = useState("My stuffed animal");

  const selectedPart = selectedInstanceId ? getPart(selectedInstanceId) : undefined;

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
      setMessage("Save failed: " + (e instanceof Error ? e.message : String(e)));
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

      {selectedPart && (
        <div className="color-panel">
          <h3>Part: {selectedPart.meshId}</h3>
          <div className="color-row">
            <label>Color</label>
            <input
              type="color"
              value={selectedPart.color}
              onChange={(e) => updatePart(selectedPart.instanceId, { color: e.target.value })}
            />
            <span className="color-hex">{selectedPart.color}</span>
          </div>
          <div className="row-colors">
            <span className="row-colors-label">Row colors (optional)</span>
            {Array.from({ length: ROW_COUNT }, (_, i) => (
              <div key={i} className="color-row">
                <label>Row {i + 1}</label>
                <input
                  type="color"
                  value={selectedPart.rowColors?.[i] ?? selectedPart.color}
                  onChange={(e) => {
                    const next = { ...selectedPart.rowColors, [i]: e.target.value };
                    updatePart(selectedPart.instanceId, { rowColors: next });
                  }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            className="remove-part-btn"
            onClick={() => removePart(selectedPart.instanceId)}
          >
            Remove part
          </button>
        </div>
      )}
    </div>
  );
}
