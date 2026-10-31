import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { initAnalytics } from "./analytics";

initAnalytics();
const root = document.getElementById("root");
root.innerHTML = ""; // replace the pre-rendered text used by search engines and no-JS visitors
createRoot(root).render(<App />);
