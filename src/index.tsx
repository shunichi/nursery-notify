import 'core-js/stable';
import 'regenerator-runtime/runtime';
import React from "react";
import ReactDOM from "react-dom";
import { App } from "./components/containers/App";

const initApp = () => {
  const root = document.getElementById("app-root");
  ReactDOM.render(<App />, root);
};

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});
