import { createRoot } from "react-dom/client";
import "./index.css";
-import App from "./App.tsx";
+import App from "./App";

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Failed to find root element");
}

createRoot(rootElement).render(<App />);
