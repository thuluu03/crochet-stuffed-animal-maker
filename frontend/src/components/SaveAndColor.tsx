import { useState } from "react";
import { useDesign } from "../designStore";
import { saveDesign } from "../api";
import { findDisconnectedParts } from "../checkConnectivity";

type ModalState =
  | { type: "success"; id: string }
  | { type: "error"; disconnected: string[] };

export function SaveAndColor() {
  const { parts, buildPayload } = useDesign();
  const [saving, setSaving] = useState(false);
  const [designName, setDesignName] = useState("My stuffed animal");
  const [modal, setModal] = useState<ModalState | null>(null);

  const handleSave = async () => {
    const disconnected = findDisconnectedParts(parts);
    if (disconnected.length > 0) {
      setModal({ type: "error", disconnected });
      return;
    }

    setSaving(true);
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
      setModal({ type: "success", id: result.id });
    } catch (e) {
      // keep saving=false, surface as alert for now
      alert("Save failed: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
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
      </div>

      {modal && (
        <div className="save-modal-backdrop" onClick={() => setModal(null)}>
          <div className="save-modal" onClick={(e) => e.stopPropagation()}>
            {modal.type === "success" ? (
              <>
                <div className="save-modal-icon success">✓</div>
                <h2 className="save-modal-title">Design saved!</h2>
                <p className="save-modal-body">
                  Your design <strong>{designName}</strong> has been saved.
                  <br />
                  <span className="save-modal-id">ID: {modal.id}</span>
                </p>
              </>
            ) : (
              <>
                <div className="save-modal-icon error">✕</div>
                <h2 className="save-modal-title">Invalid design</h2>
                <p className="save-modal-body">
                  Some parts are floating and not connected to the rest of the design:
                </p>
                <ul className="save-modal-list">
                  {modal.disconnected.map((label) => (
                    <li key={label}>{label}</li>
                  ))}
                </ul>
                <p className="save-modal-body">
                  Make sure all parts are touching before saving.
                </p>
              </>
            )}
            <button
              type="button"
              className="save-modal-close"
              onClick={() => setModal(null)}
            >
              {modal.type === "success" ? "Done" : "Go back"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
