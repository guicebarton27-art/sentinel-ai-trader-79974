import { createRoot } from "react-dom/client";
import "./env-preflight";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
