import { DesignProvider } from "./designStore";
import { DragProvider } from "./dragStore";
import { Sidebar } from "./components/Sidebar";
import { CanvasArea } from "./components/CanvasArea";
import { SaveAndColor } from "./components/SaveAndColor";
import "./App.css";

function App() {
  return (
    <DesignProvider>
      <DragProvider>
        <div className="app">
          <header className="header">
            <h1>Crochet Stuffed Animal Maker</h1>
            <SaveAndColor />
          </header>
          <div className="workspace">
            <Sidebar />
            <CanvasArea />
          </div>
        </div>
      </DragProvider>
    </DesignProvider>
  );
}

export default App;
