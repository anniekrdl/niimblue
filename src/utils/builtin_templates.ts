import * as fabric from "fabric";
import { OBJECT_DEFAULTS_TEXT, OBJECT_DEFAULTS_VECTOR } from "$/defaults";
import { TextboxExt } from "$/fabric-object/textbox-ext";
import { QRCode } from "$/fabric-object/qrcode";
import { iconCodepoints, type MaterialIcon } from "$/styles/mdi_icons";
import type { TranslationKey } from "$/utils/i18n";
import type { ExportedLabelTemplate, LabelProps } from "$/types";

/** Drawing area of a template, label size minus margins */
type Area = { x: number; y: number; w: number; h: number };

export type BuiltinTemplate = {
  id: string;
  title: TranslationKey;
  build: (canvas: fabric.StaticCanvas, area: Area) => void;
};

type TextOptions = {
  fontSize?: number;
  bold?: boolean;
  align?: "left" | "center" | "right";
  fill?: string;
  maxLines?: number;
};

/** Add a textbox at (x, y) with the given width, vertically centered in `h` */
const addText = (canvas: fabric.StaticCanvas, text: string, x: number, y: number, w: number, h: number, opts: TextOptions = {}) => {
  const obj = new TextboxExt(text, {
    ...OBJECT_DEFAULTS_TEXT,
    originX: "left",
    originY: "center",
    left: x,
    top: y + h / 2,
    width: w,
    fontSize: Math.max(8, Math.round(opts.fontSize ?? h * 0.7)),
    fontWeight: opts.bold ? "bold" : "normal",
    textAlign: opts.align ?? "center",
    fill: opts.fill ?? "black",
  });
  obj.shrinkText(w, opts.maxLines ?? 1);
  // shrinkText only checks width, also make it fit vertically
  while (obj.height > h && obj.fontSize > 8) {
    obj.set({ fontSize: obj.fontSize - 1, width: w });
  }
  canvas.add(obj);
  return obj;
};

const addIcon = (canvas: fabric.StaticCanvas, icon: MaterialIcon, x: number, y: number, size: number) => {
  const obj = new fabric.FabricText(String.fromCodePoint(iconCodepoints[icon]), {
    ...OBJECT_DEFAULTS_TEXT,
    fontFamily: "Material Icons",
    originX: "center",
    originY: "center",
    left: x + size / 2,
    top: y + size / 2,
    fontSize: Math.round(size),
  });
  canvas.add(obj);
  return obj;
};

export const BUILTIN_TEMPLATES: BuiltinTemplate[] = [
  {
    id: "big_text",
    title: "templates.builtin.big_text",
    build: (c, a) => {
      addText(c, "Label", a.x, a.y, a.w, a.h, { bold: true });
    },
  },
  {
    id: "title_sub",
    title: "templates.builtin.title_sub",
    build: (c, a) => {
      addText(c, "Titel", a.x, a.y, a.w, a.h * 0.58, { bold: true });
      addText(c, "Ondertitel", a.x, a.y + a.h * 0.62, a.w, a.h * 0.38);
    },
  },
  {
    id: "three_lines",
    title: "templates.builtin.three_lines",
    build: (c, a) => {
      const lh = a.h / 3;
      addText(c, "Naam", a.x, a.y, a.w, lh, { bold: true, align: "left", fontSize: lh * 0.75 });
      addText(c, "Straat 1", a.x, a.y + lh, a.w, lh, { align: "left", fontSize: lh * 0.65 });
      addText(c, "1234 AB Plaats", a.x, a.y + lh * 2, a.w, lh, { align: "left", fontSize: lh * 0.65 });
    },
  },
  {
    id: "icon_text",
    title: "templates.builtin.icon_text",
    build: (c, a) => {
      const size = Math.min(a.h, a.w * 0.35);
      addIcon(c, "home", a.x, a.y + (a.h - size) / 2, size);
      const gap = a.w * 0.04;
      addText(c, "Tekst", a.x + size + gap, a.y, a.w - size - gap, a.h, { bold: true, align: "left", maxLines: 2 });
    },
  },
  {
    id: "frame",
    title: "templates.builtin.frame",
    build: (c, a) => {
      const stroke = Math.max(2, Math.round(Math.min(a.w, a.h) * 0.04));
      c.add(
        new fabric.Rect({
          ...OBJECT_DEFAULTS_VECTOR,
          left: a.x,
          top: a.y,
          width: a.w - stroke,
          height: a.h - stroke,
          rx: a.h * 0.15,
          ry: a.h * 0.15,
          strokeWidth: stroke,
        }),
      );
      const pad = a.h * 0.15;
      addText(c, "Label", a.x + pad, a.y + pad, a.w - pad * 2, a.h - pad * 2, { bold: true });
    },
  },
  {
    id: "header_bar",
    title: "templates.builtin.header_bar",
    build: (c, a) => {
      const barH = a.h * 0.42;
      c.add(
        new fabric.Rect({
          ...OBJECT_DEFAULTS_VECTOR,
          left: a.x,
          top: a.y,
          width: a.w,
          height: barH,
          rx: barH * 0.2,
          ry: barH * 0.2,
          fill: "black",
          strokeWidth: 0,
        }),
      );
      addText(c, "TITEL", a.x, a.y, a.w, barH, { bold: true, fill: "white", fontSize: barH * 0.7 });
      addText(c, "Omschrijving", a.x, a.y + barH, a.w, a.h - barH, { maxLines: 2 });
    },
  },
  {
    id: "date",
    title: "templates.builtin.date",
    build: (c, a) => {
      addText(c, "Inhoud", a.x, a.y, a.w, a.h * 0.55, { bold: true });
      const lineY = a.y + a.h * 0.6;
      const stroke = Math.max(2, Math.round(a.h * 0.02));
      c.add(
        new fabric.Polyline(
          [
            { x: a.x + a.w * 0.1, y: lineY },
            { x: a.x + a.w * 0.9, y: lineY },
          ],
          // position must be set explicitly, defaults would move the line to the corner
          { ...OBJECT_DEFAULTS_VECTOR, strokeWidth: stroke, left: a.x + a.w * 0.1, top: lineY - stroke / 2 },
        ),
      );
      addText(c, "{dt|DD-MM-YYYY}", a.x, a.y + a.h * 0.64, a.w, a.h * 0.36);
    },
  },
  {
    id: "qr_text",
    title: "templates.builtin.qr_text",
    build: (c, a) => {
      const size = Math.min(a.h, a.w * 0.45);
      c.add(
        new QRCode({
          text: "https://niim.blue",
          originX: "left",
          originY: "top",
          left: a.x,
          top: a.y + (a.h - size) / 2,
          width: size,
          height: size,
        }),
      );
      const gap = a.w * 0.05;
      const tx = a.x + size + gap;
      const tw = a.w - size - gap;
      addText(c, "Scan mij", tx, a.y, tw, a.h * 0.55, { bold: true, align: "left" });
      addText(c, "niim.blue", tx, a.y + a.h * 0.55, tw, a.h * 0.45, { align: "left" });
    },
  },
];

/** Build template for the given label. Thumbnail is a transparent png. */
export const buildTemplate = (tpl: BuiltinTemplate, label: LabelProps): ExportedLabelTemplate => {
  const { width, height } = label.size;
  const el = document.createElement("canvas");
  const canvas = new fabric.StaticCanvas(el, { width, height, renderOnAddRemove: false });

  const margin = Math.round(Math.min(width, height) * 0.08);
  tpl.build(canvas, { x: margin, y: margin, w: width - margin * 2, h: height - margin * 2 });
  canvas.renderAll();

  const result: ExportedLabelTemplate = {
    canvas: canvas.toJSON(),
    label,
    title: tpl.id,
    thumbnailBase64: canvas.toDataURL({ format: "png", multiplier: Math.min(1, 160 / Math.max(width, height)) }),
  };

  canvas.dispose();
  return result;
};
