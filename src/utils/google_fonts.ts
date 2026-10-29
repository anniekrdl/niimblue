import { get } from "svelte/store";
import { loadedFonts, userFonts } from "$/stores";
import { FileUtils } from "$/utils/file_utils";

export type GoogleFontCategory = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";

export type GoogleFontInfo = {
  family: string;
  category: GoogleFontCategory;
  weights: number[];
};

/** Fontsource mirrors the Google Fonts catalog and (unlike fonts.google.com) allows browser requests */
const CATALOG_URL = "https://api.fontsource.org/v1/fonts?type=google";
const CSS_API = "https://fonts.googleapis.com/css2";

/** Used when the catalog can not be fetched */
const FALLBACK_CATALOG: GoogleFontInfo[] = (
  [
    ["Roboto", "sans-serif"],
    ["Open Sans", "sans-serif"],
    ["Montserrat", "sans-serif"],
    ["Lato", "sans-serif"],
    ["Poppins", "sans-serif"],
    ["Nunito", "sans-serif"],
    ["Oswald", "sans-serif"],
    ["Bebas Neue", "display"],
    ["Anton", "sans-serif"],
    ["Merriweather", "serif"],
    ["Playfair Display", "serif"],
    ["Lora", "serif"],
    ["Roboto Slab", "serif"],
    ["Lobster", "display"],
    ["Pacifico", "handwriting"],
    ["Dancing Script", "handwriting"],
    ["Caveat", "handwriting"],
    ["Amatic SC", "handwriting"],
    ["Permanent Marker", "handwriting"],
    ["Indie Flower", "handwriting"],
    ["Shadows Into Light", "handwriting"],
    ["Comfortaa", "display"],
    ["Fredoka", "sans-serif"],
    ["Righteous", "display"],
    ["Press Start 2P", "display"],
    ["Roboto Mono", "monospace"],
    ["Source Code Pro", "monospace"],
  ] as [string, GoogleFontCategory][]
).map(([family, category]) => ({ family, category, weights: [400] }));

let catalogCache: GoogleFontInfo[] | undefined;

export const fetchGoogleFontsCatalog = async (): Promise<{ fonts: GoogleFontInfo[]; offline: boolean }> => {
  if (catalogCache) {
    return { fonts: catalogCache, offline: false };
  }
  try {
    const resp = await fetch(CATALOG_URL);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = (await resp.json()) as { family: string; category: GoogleFontCategory; weights: number[] }[];
    catalogCache = data.map((f) => ({ family: f.family, category: f.category, weights: f.weights }));
    return { fonts: catalogCache, offline: false };
  } catch (e) {
    console.warn("Google Fonts catalog unavailable", e);
    return { fonts: FALLBACK_CATALOG, offline: true };
  }
};

const cssFamily = (family: string) => family.replaceAll(" ", "+");

/** Stylesheet URL with only the glyphs of `text`, tiny file for previews */
export const previewCssUrl = (family: string) =>
  `${CSS_API}?family=${cssFamily(family)}&text=${encodeURIComponent(family)}&display=swap`;

const pickWeight = (weights: number[]) =>
  weights.includes(400) ? 400 : weights.reduce((a, b) => (Math.abs(b - 400) < Math.abs(a - 400) ? b : a), weights[0] ?? 400);

/** Find font file url in css2 response, prefer the "latin" subset */
const findFontUrl = (css: string): { url: string; format: string } => {
  const blocks = [...css.matchAll(/(?:\/\*\s*([\w-]+)\s*\*\/\s*)?@font-face\s*{([^}]*)}/g)];
  const parsed = blocks
    .map((b) => {
      const src = b[2].match(/url\((https:[^)]+)\)\s*format\(['"]?(\w+)['"]?\)/);
      return src ? { subset: b[1], url: src[1], format: src[2] } : undefined;
    })
    .filter((b) => b !== undefined);

  const chosen = parsed.find((b) => b.subset === "latin") ?? parsed[parsed.length - 1];
  if (!chosen) {
    throw new Error("Font file not found");
  }
  return chosen;
};

/** Download font from Google Fonts and store it as user font, so it works offline and when printing */
export const installGoogleFont = async (font: GoogleFontInfo): Promise<void> => {
  if (get(userFonts).some((f) => f.family === font.family)) {
    return;
  }

  const weight = pickWeight(font.weights);
  const cssResp = await fetch(`${CSS_API}?family=${cssFamily(font.family)}:wght@${weight}&display=swap`);
  if (!cssResp.ok) throw new Error(`${font.family}: HTTP ${cssResp.status}`);
  const { url, format } = findFontUrl(await cssResp.text());

  const fontResp = await fetch(url);
  if (!fontResp.ok) throw new Error(`${font.family}: HTTP ${fontResp.status}`);
  const data = await fontResp.arrayBuffer();

  const compressed = await FileUtils.compressData(data);
  const b64data = await FileUtils.base64buf(compressed);
  const ext = format === "truetype" ? "ttf" : format;

  userFonts.update((prev) => [...prev, { gzippedDataB64: b64data, family: font.family, mimeType: `font/${ext}` }]);

  // fonts are loaded asynchronously by the userFonts subscriber, wait until it is usable by the canvas
  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => done(), 8000);
    let unsubscribe: (() => void) | undefined = undefined;
    const done = () => {
      clearTimeout(timeout);
      unsubscribe?.();
      resolve();
    };
    unsubscribe = loadedFonts.subscribe((list) => {
      if (list.some((f) => f.family === font.family)) {
        queueMicrotask(done);
      }
    });
  });
};
