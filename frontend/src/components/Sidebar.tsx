import { useState } from "react";
import { useDrag } from "../dragStore";
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
  const [activeTab, setActiveTab] = useState<Tab>("parts");

  function onDragStart(e: React.DragEvent, meshId: string, slotKind: string) {
    e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ meshId, slotKind }));
    e.dataTransfer.effectAllowed = "copy";
    setDragData({ meshId, slotKind });
  }

  function onDragEnd() {
    setDragData(null);
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        <button
          type="button"
          className={
            activeTab === "parts" ? "sidebar-tab active" : "sidebar-tab"
          }
          onClick={() => setActiveTab("parts")}
        >
          Parts
        </button>
        <button
          type="button"
          className={
            activeTab === "shapes" ? "sidebar-tab active" : "sidebar-tab"
          }
          onClick={() => setActiveTab("shapes")}
        >
          Shapes
        </button>
      </div>

      <div className="sidebar-content">
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
