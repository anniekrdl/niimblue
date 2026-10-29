import "$/styles/style.scss";
import "@popperjs/core";
import "toastify-js/src/toastify.css";
import Dropdown from "bootstrap/js/dist/dropdown";
import "bootstrap/js/dist/collapse";
import App from "$/App.svelte";
import { mount } from "svelte";
import { configureFabric } from "$/defaults";

configureFabric();

// Toolbars scroll horizontally, fixed positioning keeps dropdown menus from being clipped by them
Dropdown.Default.popperConfig = (defaultConfig) => ({ ...defaultConfig, strategy: "fixed" });

const app = mount(App, {
  target: document.getElementById("app")!,
});

export default app;
