import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Safety: provide a harmless global fallback for getTeams to avoid ReferenceError
// if any legacy script erroneously references it as a global.
if (typeof (globalThis as any).getTeams === "undefined") {
	(globalThis as any).getTeams = async () => [];
}

createRoot(document.getElementById("root")!).render(<App />);
