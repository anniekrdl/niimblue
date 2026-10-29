import { FileUtils } from "$/utils/file_utils";

/** Raster icons are downscaled to this size (longest side) to save browser storage */
const RASTER_ICON_MAX_SIZE = 256;

const ACCEPT = ".svg,.png,.jpg,.jpeg,.webp,image/svg+xml,image/png,image/jpeg,image/webp";

export const pickIconFiles = (): Promise<File[]> => {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.accept = ACCEPT;
    input.onchange = () => resolve(input.files ? [...input.files] : []);
    input.click();
  });
};

const isSvg = (file: File) => file.type.startsWith("image/svg") || file.name.toLowerCase().endsWith(".svg");

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Unable to read image"));
    img.src = url;
  });

/** Convert png/jpg to a small svg wrapper so it can be stored like other user icons */
const rasterToSvg = async (file: File): Promise<string> => {
  const img = await loadImage(await FileUtils.blobToDataUrl(file));
  const scale = Math.min(1, RASTER_ICON_MAX_SIZE / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const dataUrl = canvas.toDataURL("image/png");

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ` +
    `width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">` +
    `<image width="${w}" height="${h}" xlink:href="${dataUrl}"/></svg>`
  );
};

/** Returns svg code for the icon file, throws on unsupported files */
export const iconFileToSvg = async (file: File): Promise<string> => {
  if (isSvg(file)) {
    return await file.text();
  }
  if (file.type.startsWith("image/")) {
    return await rasterToSvg(file);
  }
  throw new Error(`${file.name}: unsupported file`);
};
