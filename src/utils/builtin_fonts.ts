import * as fabric from "fabric";

import "@fontsource/caveat/400.css";
import "@fontsource/caveat/700.css";
import "@fontsource/dancing-script/400.css";
import "@fontsource/dancing-script/700.css";
import "@fontsource/pacifico/400.css";
import "@fontsource/amatic-sc/400.css";
import "@fontsource/amatic-sc/700.css";
import "@fontsource/patrick-hand/400.css";
import "@fontsource/kalam/400.css";
import "@fontsource/kalam/700.css";
import "@fontsource/satisfy/400.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/lora/400.css";
import "@fontsource/lora/700.css";
import "@fontsource/abril-fatface/400.css";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/700.css";
import "@fontsource/quicksand/400.css";
import "@fontsource/quicksand/700.css";
import "@fontsource/comfortaa/400.css";
import "@fontsource/comfortaa/700.css";
import "@fontsource/josefin-sans/400.css";
import "@fontsource/josefin-sans/700.css";
import "@fontsource/bebas-neue/400.css";
import "@fontsource/fredoka/400.css";
import "@fontsource/fredoka/700.css";

/** Fonts shipped inside the app, so they work offline and never need to be installed */
export const BUILTIN_FONTS: string[] = [
  "Caveat",
  "Dancing Script",
  "Pacifico",
  "Amatic SC",
  "Patrick Hand",
  "Kalam",
  "Satisfy",
  "Playfair Display",
  "Lora",
  "Abril Fatface",
  "Montserrat",
  "Quicksand",
  "Comfortaa",
  "Josefin Sans",
  "Bebas Neue",
  "Fredoka",
];

/**
 * Fabric remembers letter widths per font. When a font is used before it finished loading, the widths of the
 * fallback font are remembered and the text looks wrong. Load the font first, then measure the text again.
 */
export const ensureFontReady = async (text: fabric.FabricText) => {
  const family = text.fontFamily;
  try {
    await Promise.all([
      document.fonts.load(`${text.fontWeight} 40px "${family}"`),
      document.fonts.load(`bold 40px "${family}"`),
    ]);
  } catch {
    /* unknown font, the browser falls back to another one */
  }
  remeasureText(text);
};

export const remeasureText = (text: fabric.FabricText) => {
  fabric.cache.clearFontCache(text.fontFamily);
  text.initDimensions();
  text.setCoords();
  text.dirty = true;
  text.canvas?.requestRenderAll();
};
