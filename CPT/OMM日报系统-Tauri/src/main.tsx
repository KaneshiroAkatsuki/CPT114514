import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

// Hide splash screen when React mounts
const splash = document.getElementById("splash");
if (splash) splash.style.display = "none";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
