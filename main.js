// src/main.js
import React from "react";
import { createRoot } from "react-dom/client";
import EditionGallery from "./EditionGallery.jsx";
import "./style.css";

const rootEl = document.getElementById("root");
if (!rootEl) {
  throw new Error("No #root element found in index.html");
}

createRoot(rootEl).render(
  <React.StrictMode>
    <EditionGallery />
  </React.StrictMode>
);






