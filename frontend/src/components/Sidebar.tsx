import { useDesign } from "../designStore";
import { useDrag } from "../dragStore";
import { PRESET_MESHES } from "../presets";

const DRAG_TYPE = "application/x-preset-mesh";

export function Sidebar() {
  const { setDragData } = useDrag();

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
      <h2 className="sidebar-title">Parts</h2>
      <p className="sidebar-hint">Drag a part onto the mannequin to attach it.</p>
      <ul className="preset-list">
        {PRESET_MESHES.map((preset) => (
          <li key={preset.id}>
            <div
              className="preset-card"
              draggable
              onDragStart={(e) => onDragStart(e, preset.id, preset.slotKind)}
              onDragEnd={onDragEnd}
            >
              <span className="preset-label">{preset.label}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

export { DRAG_TYPE };
