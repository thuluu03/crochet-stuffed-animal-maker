import { useRef, useState, useCallback, useEffect } from "react";
import { useDesign } from "../designStore";
import { getSegmentCount } from "../presets";
import {
  getLiveTransform,
  resetLiveTransform,
  subscribeLiveTransform,
} from "../liveTransformStore";
import {
  getTransformMode,
  setTransformMode,
  subscribeTransformMode,
  type TransformMode,
} from "../transformModeStore";

type Tab = "colors" | "transforms";

const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

type LiveVec3Key = "x" | "y" | "z";

function AxisInput({
  draftKey,
  axisKey,
  label,
  displayValue,
  step,
  drafts,
  setDraft,
  clearDraft,
  onCommit,
}: {
  draftKey: string;
  axisKey: LiveVec3Key;
  label: string;
  displayValue: string;
  step: number;
  drafts: Record<string, string>;
  setDraft: (key: string, val: string) => void;
  clearDraft: (key: string) => void;
  onCommit: (axis: LiveVec3Key, raw: string | undefined) => void;
}) {
  const draft = drafts[draftKey];
  return (
    <div className="axis-row">
      <span className={`axis-label ${label.toLowerCase()}`}>{label}</span>
      <input
        type="number"
        className="axis-input"
        value={draft ?? displayValue}
        step={step}
        onFocus={() => setDraft(draftKey, displayValue)}
        onChange={(e) => setDraft(draftKey, e.target.value)}
        onBlur={() => { onCommit(axisKey, draft); clearDraft(draftKey); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onCommit(axisKey, draft); clearDraft(draftKey); (e.target as HTMLInputElement).blur(); }
          if (e.key === "Escape") clearDraft(draftKey);
        }}
      />
    </div>
  );
}

export function ColorPopup() {
  const { selectedInstanceId, getPart, updatePart, removePart, setSelected } =
    useDesign();

  const [pos, setPos] = useState({ x: 80, y: 120 });
  const [tab, setTab] = useState<Tab>("colors");
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Live transforms from Three.js world
  const [liveTransform, setLiveTransformState] = useState(getLiveTransform);
  useEffect(() => {
    return subscribeLiveTransform((scale, position, rotation) =>
      setLiveTransformState({ scale, position, rotation })
    );
  }, []);

  // Transform mode
  const [transformMode, setTransformModeState] = useState<TransformMode>(getTransformMode);
  useEffect(() => {
    const unsub = subscribeTransformMode((m) => setTransformModeState(m));
    return () => { unsub(); };
  }, []);

  // Draft inputs — keyed by "s_x", "s_y", "s_z", "p_x", "p_y", "p_z", "r_x", "r_y", "r_z"
  // Only set while the user is actively editing that field.
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const setDraft = (key: string, val: string) =>
    setDrafts((d) => ({ ...d, [key]: val }));
  const clearDraft = (key: string) =>
    setDrafts((d) => { const n = { ...d }; delete n[key]; return n; });

  // Manual uniform-scale input
  const [manualScale, setManualScale] = useState<string>("");

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setPos({ x: ev.clientX - dragOffset.current.x, y: ev.clientY - dragOffset.current.y });
      };
      const onUp = () => {
        dragging.current = false;
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [pos],
  );

  const selectedPart = selectedInstanceId ? getPart(selectedInstanceId) : null;

  useEffect(() => {
    if (selectedPart) {
      setManualScale("");
      setDrafts({});
      const [sx, sy, sz] = selectedPart.scale;
      resetLiveTransform(
        { x: sx, y: sy, z: sz },
        { x: selectedPart.position[0], y: selectedPart.position[1], z: selectedPart.position[2] },
        { x: selectedPart.rotation[0], y: selectedPart.rotation[1], z: selectedPart.rotation[2] },
      );
    }
  }, [
    selectedPart?.scale[0], selectedPart?.scale[1], selectedPart?.scale[2],
    selectedPart?.position[0], selectedPart?.position[1], selectedPart?.position[2],
    selectedPart?.rotation[0], selectedPart?.rotation[1], selectedPart?.rotation[2],
    selectedPart?.instanceId,
  ]);

  if (!selectedPart) return null;

  const segmentCount = getSegmentCount(selectedPart.meshId);
  const liveScale = liveTransform.scale;

  // --- Commit helpers ---
  const clampScale = (v: number) => Math.max(0.2, Math.min(3, v));

  const commitScaleAxis = (axis: LiveVec3Key, raw: string | undefined) => {
    if (raw === undefined) return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) return;
    const c = clampScale(parsed);
    const next: [number, number, number] = [
      axis === "x" ? c : clampScale(liveScale.x),
      axis === "y" ? c : clampScale(liveScale.y),
      axis === "z" ? c : clampScale(liveScale.z),
    ];
    updatePart(selectedPart.instanceId, { scale: next });
    resetLiveTransform(
      { x: next[0], y: next[1], z: next[2] },
      liveTransform.position,
      liveTransform.rotation,
    );
  };

  const commitPositionAxis = (axis: LiveVec3Key, raw: string | undefined) => {
    if (raw === undefined) return;
    const parsed = parseFloat(raw);
    if (isNaN(parsed)) return;
    const next: [number, number, number] = [
      axis === "x" ? parsed : liveTransform.position.x,
      axis === "y" ? parsed : liveTransform.position.y,
      axis === "z" ? parsed : liveTransform.position.z,
    ];
    updatePart(selectedPart.instanceId, { position: next });
  };

  const commitRotationAxis = (axis: LiveVec3Key, raw: string | undefined) => {
    if (raw === undefined) return;
    const parsed = parseFloat(raw); // degrees
    if (isNaN(parsed)) return;
    const rad = parsed * DEG_TO_RAD;
    const next: [number, number, number] = [
      axis === "x" ? rad : liveTransform.rotation.x,
      axis === "y" ? rad : liveTransform.rotation.y,
      axis === "z" ? rad : liveTransform.rotation.z,
    ];
    updatePart(selectedPart.instanceId, { rotation: next });
  };

  const applyUniformScale = () => {
    const typed = parseFloat(manualScale);
    if (manualScale.trim() === "" || isNaN(typed)) return;
    const c = clampScale(typed);
    const next: [number, number, number] = [c, c, c];
    updatePart(selectedPart.instanceId, { scale: next });
    resetLiveTransform(
      { x: c, y: c, z: c },
      liveTransform.position,
      liveTransform.rotation,
    );
    setManualScale("");
  };

  return (
    <div className="color-popup" style={{ left: pos.x, top: pos.y }}>
      <div className="color-popup-header" onMouseDown={onHeaderMouseDown}>
        <span className="color-popup-title">
          {selectedPart.slotId.replace(/([A-Z])/g, " $1").trim()}
        </span>
        <button
          className="color-popup-close"
          onClick={() => {
            const next: [number, number, number] = [clampScale(liveScale.x), clampScale(liveScale.y), clampScale(liveScale.z)];
            const [ox, oy, oz] = selectedPart.scale;
            if (next[0] !== ox || next[1] !== oy || next[2] !== oz) {
              updatePart(selectedPart.instanceId, { scale: next });
            }
            setSelected(null);
          }}
          title="Close"
        >
          ✕
        </button>
      </div>

      <div className="color-popup-tabs">
        <button className={`color-popup-tab${tab === "colors" ? " active" : ""}`} onClick={() => setTab("colors")}>
          Colors
        </button>
        <button className={`color-popup-tab${tab === "transforms" ? " active" : ""}`} onClick={() => setTab("transforms")}>
          Transforms
        </button>
      </div>

      <div className="color-popup-body">
        {tab === "colors" && (
          <>
            <div className="color-row">
              <label>Base color</label>
              <input
                type="color"
                value={selectedPart.color}
                onChange={(e) => updatePart(selectedPart.instanceId, { color: e.target.value })}
              />
              <span className="color-hex">{selectedPart.color}</span>
            </div>

            {segmentCount > 0 && (
              <div className="row-colors">
                <span className="row-colors-label">Segments: {segmentCount}</span>
                <p className="segment-hint">Set a color per horizontal segment.</p>
                {Array.from({ length: segmentCount }, (_, i) => (
                  <div key={i} className="color-row">
                    <label>Segment {i + 1}</label>
                    <input
                      type="color"
                      value={selectedPart.rowColors?.[i] ?? selectedPart.color}
                      onChange={(e) => {
                        const next = { ...selectedPart.rowColors, [i]: e.target.value };
                        updatePart(selectedPart.instanceId, { rowColors: next });
                      }}
                    />
                    <span className="color-hex">
                      {selectedPart.rowColors?.[i] ?? selectedPart.color}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "transforms" && (
          <div className="transforms-panel">
            <div className="transform-mode-row">
              {(["translate", "rotate", "scale"] as TransformMode[]).map((m) => (
                <button
                  key={m}
                  className={`transform-mode-btn${transformMode === m ? " active" : ""}`}
                  onClick={() => setTransformMode(m)}
                  title={m.charAt(0).toUpperCase() + m.slice(1)}
                >
                  {m === "translate" ? "T" : m === "rotate" ? "R" : "S"}
                </button>
              ))}
            </div>

            {transformMode === "scale" && (
              <>
                <div className="axis-readout">
                  <AxisInput draftKey="s_x" axisKey="x" label="X" displayValue={liveScale.x.toFixed(3)} onCommit={commitScaleAxis} step={0.05} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                  <AxisInput draftKey="s_y" axisKey="y" label="Y" displayValue={liveScale.y.toFixed(3)} onCommit={commitScaleAxis} step={0.05} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                  <AxisInput draftKey="s_z" axisKey="z" label="Z" displayValue={liveScale.z.toFixed(3)} onCommit={commitScaleAxis} step={0.05} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                </div>
                <div className="manual-scale">
                  <label className="manual-scale-label">Uniform scale</label>
                  <div className="manual-scale-row">
                    <input
                      type="number"
                      className="manual-scale-input"
                      placeholder={((liveScale.x + liveScale.y + liveScale.z) / 3).toFixed(2)}
                      value={manualScale}
                      min={0.2}
                      max={3}
                      step={0.05}
                      onChange={(e) => setManualScale(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && applyUniformScale()}
                    />
                    <button type="button" className="apply-scale-btn" onClick={applyUniformScale}>
                      Apply
                    </button>
                  </div>
                </div>
              </>
            )}

            {transformMode === "translate" && (
              <div className="axis-readout">
                <AxisInput draftKey="p_x" axisKey="x" label="X" displayValue={liveTransform.position.x.toFixed(3)} onCommit={commitPositionAxis} step={0.01} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                <AxisInput draftKey="p_y" axisKey="y" label="Y" displayValue={liveTransform.position.y.toFixed(3)} onCommit={commitPositionAxis} step={0.01} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                <AxisInput draftKey="p_z" axisKey="z" label="Z" displayValue={liveTransform.position.z.toFixed(3)} onCommit={commitPositionAxis} step={0.01} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
              </div>
            )}

            {transformMode === "rotate" && (
              <div className="axis-readout">
                <AxisInput draftKey="r_x" axisKey="x" label="X" displayValue={(liveTransform.rotation.x * RAD_TO_DEG).toFixed(1)} onCommit={commitRotationAxis} step={1} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                <AxisInput draftKey="r_y" axisKey="y" label="Y" displayValue={(liveTransform.rotation.y * RAD_TO_DEG).toFixed(1)} onCommit={commitRotationAxis} step={1} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
                <AxisInput draftKey="r_z" axisKey="z" label="Z" displayValue={(liveTransform.rotation.z * RAD_TO_DEG).toFixed(1)} onCommit={commitRotationAxis} step={1} drafts={drafts} setDraft={setDraft} clearDraft={clearDraft} />
              </div>
            )}

            <p className="transforms-hint saved-note">
              {transformMode === "scale"
                ? "Gizmo drags save on release."
                : "Type a value and press Enter, or drag the gizmo."}
            </p>
          </div>
        )}

        <button
          type="button"
          className="remove-part-btn"
          onClick={() => removePart(selectedPart.instanceId)}
        >
          Remove part
        </button>
      </div>
    </div>
  );
}
