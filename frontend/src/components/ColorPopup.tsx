import { useRef, useState, useCallback, useEffect } from "react";
import { useDesign } from "../designStore";
import { getSegmentCount } from "../presets";
import {
  getLiveScale,
  resetLiveScale,
  subscribeLiveScale,
} from "../liveTransformStore";

type Tab = "colors" | "transforms";

export function ColorPopup() {
  const { selectedInstanceId, getPart, updatePart, removePart, setSelected } =
    useDesign();

  const [pos, setPos] = useState({ x: 80, y: 120 });
  const [tab, setTab] = useState<Tab>("colors");
  const dragging = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Live scale from Three.js world (no React state in PartMesh = no re-renders there)
  const [liveScale, setLiveScaleState] = useState(getLiveScale);
  useEffect(() => {
    return subscribeLiveScale((x, y, z) => setLiveScaleState({ x, y, z }));
  }, []);

  // Manual scale input state
  const [manualScale, setManualScale] = useState<string>("");

  const onHeaderMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true;
      dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };

      const onMove = (ev: MouseEvent) => {
        if (!dragging.current) return;
        setPos({
          x: ev.clientX - dragOffset.current.x,
          y: ev.clientY - dragOffset.current.y,
        });
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

  // Reset manual input and live store when part changes or its stored scale updates
  useEffect(() => {
    if (selectedPart) {
      setManualScale(""); // clear so Apply defaults to live per-axis values
      const [sx, sy, sz] = selectedPart.scale;
      resetLiveScale(sx, sy, sz);
    }
  }, [selectedPart?.scale[0], selectedPart?.scale[1], selectedPart?.scale[2], selectedPart?.instanceId]);

  if (!selectedPart) return null;

  const segmentCount = getSegmentCount(selectedPart.meshId);

  const applyScale = () => {
    const clamp = (v: number) => Math.max(0.2, Math.min(3, v));
    const typed = parseFloat(manualScale);
    let next: [number, number, number];
    if (manualScale.trim() !== "" && !isNaN(typed)) {
      // User explicitly typed a uniform value — apply to all three axes
      const c = clamp(typed);
      next = [c, c, c];
    } else {
      // No typed override — save the exact per-axis live values from the handles
      next = [clamp(liveScale.x), clamp(liveScale.y), clamp(liveScale.z)];
    }
    updatePart(selectedPart.instanceId, { scale: next });
    resetLiveScale(...next);
    setManualScale(""); // clear so next Apply again reads from handles
  };

  return (
    <div className="color-popup" style={{ left: pos.x, top: pos.y }}>
      {/* Drag handle / title bar */}
      <div className="color-popup-header" onMouseDown={onHeaderMouseDown}>
        <span className="color-popup-title">
          {selectedPart.slotId.replace(/([A-Z])/g, " $1").trim()}
        </span>
        <button
          className="color-popup-close"
          onClick={() => {
            // Auto-save per-axis live scale before closing
            const clamp = (v: number) => Math.max(0.2, Math.min(3, v));
            const next: [number, number, number] = [clamp(liveScale.x), clamp(liveScale.y), clamp(liveScale.z)];
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

      {/* Tabs */}
      <div className="color-popup-tabs">
        <button
          className={`color-popup-tab${tab === "colors" ? " active" : ""}`}
          onClick={() => setTab("colors")}
        >
          Colors
        </button>
        <button
          className={`color-popup-tab${tab === "transforms" ? " active" : ""}`}
          onClick={() => setTab("transforms")}
        >
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
                onChange={(e) =>
                  updatePart(selectedPart.instanceId, { color: e.target.value })
                }
              />
              <span className="color-hex">{selectedPart.color}</span>
            </div>

            {segmentCount > 0 && (
              <div className="row-colors">
                <span className="row-colors-label">
                  Segments: {segmentCount}
                </span>
                <p className="segment-hint">
                  Set a color per horizontal segment.
                </p>
                {Array.from({ length: segmentCount }, (_, i) => (
                  <div key={i} className="color-row">
                    <label>Segment {i + 1}</label>
                    <input
                      type="color"
                      value={selectedPart.rowColors?.[i] ?? selectedPart.color}
                      onChange={(e) => {
                        const next = {
                          ...selectedPart.rowColors,
                          [i]: e.target.value,
                        };
                        updatePart(selectedPart.instanceId, {
                          rowColors: next,
                        });
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
            {/* Live axis readout */}
            <p className="transforms-hint">
              Drag the 3D handles to scale. Values update live.
            </p>
            <div className="axis-readout">
              <div className="axis-row">
                <span className="axis-label x">X</span>
                <span className="axis-value">{liveScale.x.toFixed(3)}</span>
              </div>
              <div className="axis-row">
                <span className="axis-label y">Y</span>
                <span className="axis-value">{liveScale.y.toFixed(3)}</span>
              </div>
              <div className="axis-row">
                <span className="axis-label z">Z</span>
                <span className="axis-value">{liveScale.z.toFixed(3)}</span>
              </div>
            </div>

            {/* Manual uniform scale */}
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
                  onKeyDown={(e) => e.key === "Enter" && applyScale()}
                />
                <button
                  type="button"
                  className="apply-scale-btn"
                  onClick={applyScale}
                >
                  Apply
                </button>
              </div>
            </div>

            <p className="transforms-hint saved-note">
              Changes from handles save automatically on release.
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
