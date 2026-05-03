import { DesignProvider } from "./designStore";
import { DragProvider } from "./dragStore";
import { Sidebar } from "./components/Sidebar";
import { CanvasArea } from "./components/CanvasArea";
import { SaveAndColor } from "./components/SaveAndColor";
import { ColorPopup } from "./components/ColorPopup";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import "./App.css";

function KeyboardShortcuts() {
  useKeyboardShortcuts();
  return null;
}

function App() {
  return (
    <DesignProvider>
      <DragProvider>
        <KeyboardShortcuts />
        <div className="app">
          <header className="header">
            <h1>Crochet Stuffed Animal Maker</h1>
            <SaveAndColor />
          </header>
          <div className="workspace">
            <CanvasArea />
            <Sidebar />
          </div>
          <ColorPopup />
        </div>
      </DragProvider>
    </DesignProvider>
  );
}

export default App;
