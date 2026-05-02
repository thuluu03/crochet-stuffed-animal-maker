import { useEffect, useState } from "react";
import { useDrag } from "../dragStore";
import { useDesign } from "../designStore";
import { getDesign, inferSketchParts, listDesigns, listSketches, uploadSketch } from "../api";
import { PART_SECTIONS, SHAPES } from "../presets";

const DRAG_TYPE = "application/x-preset-mesh";

type Tab = "parts" | "shapes";

function ShapePreview({ shapeId }: { shapeId: string }) {
  return (
    <div className="shape-preview" aria-hidden="true">
      {shapeId === "sphere" && <span className="shape-preview-sphere" />}
      {shapeId === "cylinder" && <span className="shape-preview-cylinder" />}
      {shapeId === "cone" && <span className="shape-preview-cone" />}
    </div>
  );
}

export function Sidebar() {
  const { setDragData } = useDrag();
  const { applyInferredParts, loadSavedDesignParts } = useDesign();
  const [activeTab, setActiveTab] = useState<Tab>("parts");
  const [availableSketches, setAvailableSketches] = useState<string[]>([]);
  const [selectedSketch, setSelectedSketch] = useState("");
  const [loadingSketches, setLoadingSketches] = useState(false);
  const [inferLoading, setInferLoading] = useState(false);
  const [availableDesigns, setAvailableDesigns] = useState<{ id: string; name?: string; updatedAt: string }[]>([]);
  const [selectedDesignId, setSelectedDesignId] = useState("");
  const [uploadingSketch, setUploadingSketch] = useState(false);
  const [loadingDesigns, setLoadingDesigns] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    async function loadSketchesAndDesigns() {
      setLoadingSketches(true);
      setLoadingDesigns(true);
      try {
        const [sketches, designs] = await Promise.all([listSketches(), listDesigns()]);
        setAvailableSketches(sketches);
        if (sketches.length > 0) setSelectedSketch(sketches[0]);
        setAvailableDesigns(designs);
        if (designs.length > 0) setSelectedDesignId((prev) => prev || designs[0].id);
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingSketches(false);
        setLoadingDesigns(false);
      }
    }
    void loadSketchesAndDesigns();
  }, []);

  function onDragStart(e: React.DragEvent, meshId: string, slotKind: string) {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ meshId, slotKind }));
    e.dataTransfer.effectAllowed = "copy";
    setDragData({ meshId, slotKind });
  }

  function onDragEnd() {
    setDragData(null);
  }

  async function onInferFromSketch() {
    if (!selectedSketch) return;
    setInferLoading(true);
    try {
      const result = await inferSketchParts({ sketchPath: selectedSketch });
      applyInferredParts(result.placedParts);
    } catch (error) {
      alert("Sketch inference failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setInferLoading(false);
    }
  }

  async function onUploadSketch(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSketch(true);
    try {
      const result = await uploadSketch(file);
      const sketches = await listSketches();
      setAvailableSketches(sketches);
      setSelectedSketch(result.filename);
    } catch (error) {
      alert("Sketch upload failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setUploadingSketch(false);
      e.target.value = "";
    }
  }

  async function onPreviewDesign() {
    if (!selectedDesignId) return;
    setPreviewLoading(true);
    try {
      const design = await getDesign(selectedDesignId);
      loadSavedDesignParts(design.parts);
    } catch (error) {
      alert("Design preview failed: " + (error instanceof Error ? error.message : String(error)));
    } finally {
      setPreviewLoading(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-content">
        <div className="sketch-infer-panel">
          <h2 className="sidebar-title">Sketch to Parts</h2>
          <p className="sidebar-hint">
            Infer body parts from a sketch in backend/data/sketches.
          </p>
          <div className="sketch-infer-controls">
            <label className="upload-label">
              Upload image
              <input
                className="upload-input"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/bmp"
                disabled={uploadingSketch}
                onChange={onUploadSketch}
              />
            </label>
            <select
              className="sketch-select"
              value={selectedSketch}
              disabled={loadingSketches || inferLoading || uploadingSketch || availableSketches.length === 0}
              onChange={(e) => setSelectedSketch(e.target.value)}
            >
              {availableSketches.length === 0 ? (
                <option value="">
                  {loadingSketches ? "Loading sketches..." : "No sketches found"}
                </option>
              ) : (
                availableSketches.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className="sketch-infer-btn"
              disabled={!selectedSketch || inferLoading || loadingSketches || uploadingSketch}
              onClick={onInferFromSketch}
            >
              {inferLoading ? "Inferring..." : "Infer from sketch"}
            </button>
          </div>
        </div>

        <div className="sketch-infer-panel">
          <h2 className="sidebar-title">Saved Design Preview</h2>
          <p className="sidebar-hint">
            Choose a saved design and load it into the scene.
          </p>
          <div className="sketch-infer-controls">
            <select
              className="sketch-select"
              value={selectedDesignId}
              disabled={loadingDesigns || previewLoading || availableDesigns.length === 0}
              onChange={(e) => setSelectedDesignId(e.target.value)}
            >
              {availableDesigns.length === 0 ? (
                <option value="">
                  {loadingDesigns ? "Loading designs..." : "No saved designs"}
                </option>
              ) : (
                availableDesigns.map((design) => (
                  <option key={design.id} value={design.id}>
                    {design.name?.trim() ? `${design.name} (${design.id.slice(0, 8)})` : design.id}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className="sketch-infer-btn"
              disabled={!selectedDesignId || loadingDesigns || previewLoading}
              onClick={onPreviewDesign}
            >
              {previewLoading ? "Loading..." : "Preview design"}
            </button>
          </div>
        </div>

        <div className="sidebar-tabs">
          <button
            type="button"
            className={activeTab === "parts" ? "sidebar-tab active" : "sidebar-tab"}
            onClick={() => setActiveTab("parts")}
          >
            Parts
          </button>
          <button
            type="button"
            className={activeTab === "shapes" ? "sidebar-tab active" : "sidebar-tab"}
            onClick={() => setActiveTab("shapes")}
          >
            Shapes
          </button>
        </div>

        {activeTab === "parts" ? (
          <>
            <h2 className="sidebar-title">Parts</h2>
            <p className="sidebar-hint">
              Drag a part onto the mannequin to attach it.
            </p>

            <div className="part-sections">
              {PART_SECTIONS.map((section) => (
                <section key={section.id} className="part-section">
                  <h3 className="part-section-title">{section.label}</h3>

                  <ul className="part-item-list">
                    {section.items.map((item) => (
                      <li key={item.id}>
                        <div
                          className="preset-card"
                          draggable
                          onDragStart={(e) =>
                            onDragStart(e, item.id, item.slotKind)
                          }
                          onDragEnd={onDragEnd}
                        >
                          <span className="preset-label">{item.label}</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2 className="sidebar-title">Shapes</h2>
            <p className="sidebar-hint">
              Drag a basic shape onto the mannequin to build custom pieces.
            </p>
            <ul className="shape-list">
              {SHAPES.map((shape) => (
                <li key={shape.id}>
                  <div
                    className="shape-card"
                    draggable
                    onDragStart={(e) =>
                      onDragStart(e, shape.id, shape.slotKind)
                    }
                    onDragEnd={onDragEnd}
                  >
                    <ShapePreview shapeId={shape.id} />
                    <span className="shape-label">{shape.label}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  );
}

export { DRAG_TYPE };
