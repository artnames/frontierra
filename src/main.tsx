import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const rootElement = document.getElementById("root");

if (rootElement) {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <App />
      </StrictMode>
    );
  } catch (error) {
    console.error("Failed to render app:", error);
    rootElement.innerHTML = `
      <div style="padding: 20px; font-family: system-ui; color: #ff6b6b; background: #1a1a2e; min-height: 100vh;">
        <h1>Failed to load application</h1>
        <pre style="background: #16213e; padding: 10px; border-radius: 4px; overflow: auto;">${error}</pre>
      </div>
    `;
  }
} else {
  console.error("Root element not found");
}
