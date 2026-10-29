import type { TranslationKey } from "$/utils/i18n";

export type AccentColor = {
  /** buttons, active tab, peach panel */
  main: string;
  /** tiles inside the panel */
  soft: string;
  name: TranslationKey;
  group: "bright" | "soft";
};

/** Accent colors that read well on the dark theme, with dark text on top */
export const ACCENT_COLORS = {
  lavender: { main: "#b4a2f7", soft: "#e3dbfd", name: "ui.accent.lavender", group: "bright" },
  sky: { main: "#8ac4f5", soft: "#d6eafc", name: "ui.accent.sky", group: "bright" },
  mint: { main: "#7fd6b0", soft: "#d3f2e4", name: "ui.accent.mint", group: "bright" },
  pink: { main: "#f5a3c7", soft: "#fcdcea", name: "ui.accent.pink", group: "bright" },
  coral: { main: "#f59a85", soft: "#fcd9d0", name: "ui.accent.coral", group: "bright" },
  lemon: { main: "#e9d46f", soft: "#f7efc4", name: "ui.accent.lemon", group: "bright" },
  peach: { main: "#f2c394", soft: "#fae0c4", name: "ui.accent.peach", group: "bright" },
  silver: { main: "#c9ccd6", soft: "#eceef2", name: "ui.accent.silver", group: "bright" },
  sage: { main: "#a3b8a0", soft: "#dde6db", name: "ui.accent.sage", group: "soft" },
  dustyRose: { main: "#c9a3a8", soft: "#ecdcde", name: "ui.accent.dusty_rose", group: "soft" },
  dustyBlue: { main: "#9aaec4", soft: "#dbe3ec", name: "ui.accent.dusty_blue", group: "soft" },
  mauve: { main: "#b3a6bf", soft: "#e4dfe9", name: "ui.accent.mauve", group: "soft" },
  slate: { main: "#8e99a8", soft: "#d5dae1", name: "ui.accent.slate", group: "soft" },
  moss: { main: "#a6ad8a", soft: "#e1e4d4", name: "ui.accent.moss", group: "soft" },
} satisfies Record<string, AccentColor>;

export type AccentColorId = keyof typeof ACCENT_COLORS;

export const DEFAULT_ACCENT: AccentColorId = "lavender";

const hexToRgb = (hex: string): string =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(", ");

/** Puts the accent into the css variables used by the whole app */
export const applyAccentColor = (id: string) => {
  const color: AccentColor = ACCENT_COLORS[id as AccentColorId] ?? ACCENT_COLORS[DEFAULT_ACCENT];
  const root = document.documentElement.style;
  root.setProperty("--np-accent", color.main);
  root.setProperty("--np-accent-soft", color.soft);
  root.setProperty("--bs-primary", color.main);
  root.setProperty("--bs-primary-rgb", hexToRgb(color.main));
  root.setProperty("--bs-link-color", color.main);
  root.setProperty("--bs-link-color-rgb", hexToRgb(color.main));
  root.setProperty("--bs-link-hover-color", color.soft);
  root.setProperty("--bs-link-hover-color-rgb", hexToRgb(color.soft));
  root.setProperty("--bs-focus-ring-color", `rgba(${hexToRgb(color.main)}, 0.35)`);
};
