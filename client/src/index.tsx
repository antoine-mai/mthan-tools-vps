import React from "react";
import ReactDOM from "react-dom/client";

import Main from "./main";
import "./_styles/index.css";
import { syncColorModeWithSystem } from "_utils/color-mode";
import reportWebVitals from "./reportWebVitals";

syncColorModeWithSystem();

const rootElement = document.getElementById("root");

if (!rootElement) {
    throw new Error("Root element not found");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <Main />
    </React.StrictMode>,
);

reportWebVitals();
