import { useRef, useState, useCallback, useEffect, useMemo } from "react";
import { useDesign } from "../designStore";

const MIRROR_SLOTS: Record<string, string> = {
  leftArm: "rightArm", rightArm: "leftArm",
  leftLeg: "rightLeg", rightLeg: "leftLeg",
  leftEar: "rightEar", rightEar: "leftEar",
};
import { computePatternRowCount } from "../patternRowCount";
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
import { setHighlight, clearHighlight } from "../highlightStore";
import { activateEyedropper, deactivateEyedropper, subscribeEyedropper } from "../eyedropperStore";

type Tab = "colors" | "transforms";

const PALETTE_COLORS = [
  "#ffffff", "#f5f0e8", "#d4c5b0", "#9e8c7a", "#5c4f3d", "#1a1a18",
  "#e8453c", "#e87a3c", "#e8b83c", "#a8d43c", "#3cd47a", "#3cb0e8",
  "#3c6ae8", "#8a3ce8", "#e83cb0", "#e83c78", "#c87070", "#70a8c8",
];

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
  const { selectedInstanceId, getPart, getPartsBySlot, updatePart, insertPart, removePart, setSelected } =
    useDesign();

  const [pos, setPos] = useState({ x: 80, y: 120 });
  const [tab, setTab] = useState<Tab>("transforms");
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

  const [selectedSegments, setSelectedSegments] = useState<Set<number>>(new Set());
  const [lastClickedSeg, setLastClickedSeg] = useState<number | null>(null);
  const [baseSelected, setBaseSelected] = useState(false);
  const [eyedropperActive, setEyedropperActive] = useState(false);
  const [customColors, setCustomColors] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("customPaletteColors") ?? "[]"); }
    catch { return []; }
  });
  const [customPickerOpen, setCustomPickerOpen] = useState(false);
  const [pendingColor, setPendingColor] = useState("#ffffff");

  useEffect(() => {
    const unsub = subscribeEyedropper(setEyedropperActive);
    return () => {
      unsub();
    };
  }, []);

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
      setSelectedSegments(new Set());
      setLastClickedSeg(null);
      setBaseSelected(false);
      deactivateEyedropper();
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

  const segmentsKey = useMemo(() => [...selectedSegments].sort().join(","), [selectedSegments]);

  useEffect(() => {
    if (selectedPart && selectedSegments.size > 0) {
      setHighlight(selectedPart.instanceId, [...selectedSegments]);
    } else {
      clearHighlight();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [segmentsKey, selectedPart?.instanceId]);

  if (!selectedPart) return null;

  const segmentCount = computePatternRowCount(selectedPart.meshId, selectedPart.scale);
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

  function applyColor(hex: string) {
    if (baseSelected) {
      updatePart(selectedPart!.instanceId, { color: hex, rowColors: {} });
    }
    if (selectedSegments.size > 0) {
      const next = { ...selectedPart!.rowColors };
      for (const i of selectedSegments) next[i] = hex;
      updatePart(selectedPart!.instanceId, { rowColors: next });
    }
    setSelectedSegments(new Set());
    setBaseSelected(false);
  }

  function handleChipClick(i: number, e: React.MouseEvent) {
    if (e.shiftKey && lastClickedSeg !== null) {
      const lo = Math.min(lastClickedSeg, i);
      const hi = Math.max(lastClickedSeg, i);
      setSelectedSegments((prev) => {
        const next = new Set(prev);
        for (let j = lo; j <= hi; j++) next.add(j);
        return next;
      });
    } else {
      setSelectedSegments((prev) =>
        prev.size === 1 && prev.has(i) ? new Set() : new Set([i])
      );
      setLastClickedSeg(i);
    }
  }

  const mirrorSlotId = MIRROR_SLOTS[selectedPart.slotId];
  const mirrorPart = mirrorSlotId ? getPartsBySlot(mirrorSlotId)[0] : undefined;
  const mirrorLabel = mirrorSlotId ? mirrorSlotId.replace(/([A-Z])/g, " $1").trim() : "";

  const MirrorButton = mirrorSlotId ? (
    <button
      type="button"
      className="mirror-part-btn"
      title={`Copy to ${mirrorLabel}`}
      onClick={() => {
        const [px, py, pz] = selectedPart.position;
        const [rx, ry, rz] = selectedPart.rotation;
        const sharedProps = {
          color: selectedPart.color,
          rowColors: selectedPart.rowColors ? { ...selectedPart.rowColors } : undefined,
          scale: [...selectedPart.scale] as [number, number, number],
          position: [-px, py, pz] as [number, number, number],
          rotation: [rx, -ry, -rz] as [number, number, number],
        };
        if (mirrorPart) {
          updatePart(mirrorPart.instanceId, sharedProps);
        } else {
          insertPart({
            instanceId: "part-" + Math.random().toString(36).slice(2, 11),
            meshId: selectedPart.meshId,
            slotId: mirrorSlotId,
            ...sharedProps,
          });
        }
      }}
    >
      Copy to mirror
    </button>
  ) : null;

  const RemoveButton = (
    <button
      type="button"
      className="remove-part-btn"
      onClick={() => removePart(selectedPart.instanceId)}
    >
      Remove part
    </button>
  );

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
        <button className={`color-popup-tab${tab === "transforms" ? " active" : ""}`} onClick={() => setTab("transforms")}>
          Transforms
        </button>
        <button className={`color-popup-tab${tab === "colors" ? " active" : ""}`} onClick={() => setTab("colors")}>
          Colors
        </button>
      </div>

      <div className="color-popup-body">
        {tab === "colors" && (
          <>
            <div className="row-colors-header">
              <span className="row-colors-label">
                {(() => {
                  const n = selectedSegments.size + (baseSelected ? 1 : 0);
                  return n === 0 ? "Click rows to select" : `${n} selected`;
                })()}
              </span>
              {(selectedSegments.size > 0 || baseSelected) && (
                <button
                  type="button"
                  className="row-colors-clear"
                  onClick={() => { setSelectedSegments(new Set()); setBaseSelected(false); }}
                >
                  Clear
                </button>
              )}
            </div>

            <div className="overall-color-section">
              <button
                type="button"
                className={`overall-color-item${baseSelected ? " selected" : ""}`}
                onClick={() => setBaseSelected((b) => !b)}
              >
                <span className="overall-color-dot" style={{ background: selectedPart.color }} />
                <span className="overall-color-label">Overall</span>
              </button>
            </div>

            <div className="segment-rows">
              {Array.from({ length: segmentCount }, (_, displayIdx) => {
                const i = segmentCount - 1 - displayIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`segment-row-item${selectedSegments.has(i) ? " selected" : ""}`}
                    onClick={(e) => handleChipClick(i, e)}
                  >
                    <span className="segment-row-dot" style={{ background: selectedPart.rowColors?.[i] ?? selectedPart.color }} />
                    <span className="segment-row-label">Row {displayIdx + 1}</span>
                  </button>
                );
              })}
            </div>

            {MirrorButton}
            {RemoveButton}

            <div className="color-palette">
              {PALETTE_COLORS.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="palette-swatch"
                  style={{ background: hex }}
                  onClick={() => applyColor(hex)}
                  title={hex}
                />
              ))}
              {customColors.map((hex) => (
                <button
                  key={hex}
                  type="button"
                  className="palette-swatch palette-swatch-added"
                  style={{ background: hex }}
                  onClick={() => applyColor(hex)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    const next = customColors.filter((c) => c !== hex);
                    setCustomColors(next);
                    localStorage.setItem("customPaletteColors", JSON.stringify(next));
                  }}
                  title={`Custom: ${hex} (right-click to remove)`}
                />
              ))}
              <button
                type="button"
                className="palette-swatch palette-swatch-custom"
                onClick={() => { setCustomPickerOpen(true); setPendingColor("#ffffff"); }}
                title="Custom color"
              >
                +
              </button>
              <button
                type="button"
                className={`palette-swatch palette-swatch-eyedropper${eyedropperActive ? " active" : ""}`}
                title="Pick color from shape"
                onClick={() => {
                  if (eyedropperActive) {
                    deactivateEyedropper();
                  } else {
                    activateEyedropper((hex) => applyColor(hex));
                  }
                }}
              >
                ◉
              </button>
              {customPickerOpen && (
                <div className="custom-picker-panel">
                  <input
                    type="color"
                    className="custom-picker-input"
                    value={pendingColor}
                    onChange={(e) => setPendingColor(e.target.value)}
                  />
                  <div className="custom-picker-actions">
                    <button
                      type="button"
                      className="custom-picker-done"
                      onClick={() => {
                        applyColor(pendingColor);
                        if (!PALETTE_COLORS.includes(pendingColor) && !customColors.includes(pendingColor)) {
                          const next = [...customColors, pendingColor];
                          setCustomColors(next);
                          localStorage.setItem("customPaletteColors", JSON.stringify(next));
                        }
                        setCustomPickerOpen(false);
                      }}
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      className="custom-picker-cancel"
                      onClick={() => setCustomPickerOpen(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
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
            {MirrorButton}
            {RemoveButton}
          </div>
        )}
      </div>
    </div>
  );
}
