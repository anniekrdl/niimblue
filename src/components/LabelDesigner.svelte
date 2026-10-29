<script lang="ts">
  import Dropdown from "bootstrap/js/dist/dropdown";
  import * as fabric from "fabric";
  import { onDestroy, onMount, tick } from "svelte";
  import { ArUcoMarker } from "$/fabric-object/aruco";
  import { Barcode } from "$/fabric-object/barcode";
  import { QRCode } from "$/fabric-object/qrcode";
  import { iconCodepoints, type MaterialIcon } from "$/styles/mdi_icons";
  import { accentColor, appConfig, automation, connectionState, csvData, loadedFonts, printerMeta } from "$/stores";
  import {
    type ExportedLabelTemplate,
    type FabricJson,
    type LabelProps,
    type MoveDirection,
    type OjectType,
  } from "$/types";
  import { FileUtils } from "$/utils/file_utils";
  import { ensureFontReady, remeasureText } from "$/utils/builtin_fonts";
  import { tr } from "$/utils/i18n";
  import { LabelDesignerObjectHelper } from "$/utils/label_designer_object_helper";
  import { LocalStoragePersistence } from "$/utils/persistence";
  import { Toasts } from "$/utils/toasts";
  import { UndoRedo, type UndoState } from "$/utils/undo_redo";
  import BarcodeParamsPanel from "$/components/designer-controls/BarcodeParamsControls.svelte";
  import CsvControl from "$/components/designer-controls/CsvControl.svelte";
  import GenericObjectParamsControls from "$/components/designer-controls/GenericObjectParamsControls.svelte";
  import IconPicker from "$/components/designer-controls/IconPicker.svelte";
  import AppModal from "$/components/basic/AppModal.svelte";
  import LabelPropsEditor from "$/components/designer-controls/LabelPropsEditor.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import ObjectPicker from "$/components/designer-controls/ObjectPicker.svelte";
  import PrintPreview from "$/components/PrintPreview.svelte";
  import ArUcoParamsPanel from "$/components/designer-controls/ArUcoParamsControls.svelte";
  import QrCodeParamsPanel from "$/components/designer-controls/QRCodeParamsControls.svelte";
  import TextParamsControls from "$/components/designer-controls/TextParamsControls.svelte";
  import VariableInsertControl from "$/components/designer-controls/VariableInsertControl.svelte";
  import { DEFAULT_LABEL_PRESETS, DEFAULT_LABEL_PROPS, GRID_SIZE, OBJECT_DEFAULTS } from "$/defaults";
  import { LabelDesignerUtils } from "$/utils/label_designer_utils";
  import SavedLabelsMenu from "$/components/designer-controls/SavedLabelsMenu.svelte";
  import { CustomCanvas } from "$/fabric-object/custom_canvas";
  import VectorParamsControls from "$/components/designer-controls/VectorParamsControls.svelte";
  import { CanvasUtils } from "$/utils/canvas_utils";
  import TemplatesMenu from "$/components/designer-controls/TemplatesMenu.svelte";

  let htmlCanvas: HTMLCanvasElement;
  let stageEl: HTMLDivElement;

  let fabricCanvas = $state<CustomCanvas>();
  let labelProps = $state<LabelProps>(DEFAULT_LABEL_PROPS);
  let previewOpened = $state<boolean>(false);
  let selectedObject = $state<fabric.FabricObject | undefined>(undefined);
  let selectedCount = $state<number>(0);
  let editRevision = $state<number>(0);
  let printNow = $state<boolean>(false);
  let csvEnabled = $state<boolean>(false);
  let windowWidth = $state<number>(0);
  let undoState = $state<UndoState>({ undoDisabled: false, redoDisabled: false });
  let zoomText = $state<string>("100%");
  let lastPrinterDpi = $state<number | undefined>(readLastPrinterDpi());

  function readLastPrinterDpi(): number | undefined {
    try {
      return Number(localStorage.getItem("last_printer_dpi")) || undefined;
    } catch {
      return undefined;
    }
  }

  // handles use the accent color, MainPage updates the css variable first
  $effect(() => {
    void $accentColor;
    requestAnimationFrame(() => fabricCanvas?.refreshHandles());
  });

  $effect(() => {
    if (!$printerMeta) return;
    lastPrinterDpi = $printerMeta.dpi;
    try {
      localStorage.setItem("last_printer_dpi", String($printerMeta.dpi));
    } catch {
      /* storage not available, the size is guessed next time */
    }
  });

  /** Label size in mm. Uses the resolution of the connected (or last connected) printer, otherwise guesses it from the presets. */
  let sizeText = $derived.by<string>(() => {
    const { width, height } = labelProps.size;
    const isWhole = (v: number) => Math.abs(v - Math.round(v)) < 0.15;
    const knownDpi = $printerMeta?.dpi ?? lastPrinterDpi;
    const dpmm = knownDpi
      ? knownDpi / 25.4
      : [...new Set(DEFAULT_LABEL_PRESETS.map((p) => p.dpmm))].find((d) => isWhole(width / d) && isWhole(height / d));
    if (dpmm === undefined) return `${width} × ${height} px`;
    return `${Math.round(width / dpmm)} × ${Math.round(height / dpmm)} mm`;
  });

  const undo = new UndoRedo();

  const discardSelection = () => {
    fabricCanvas!.discardActiveObject();
    fabricCanvas!.requestRenderAll();
    selectedObject = undefined;
    selectedCount = 0;
    editRevision = 0;
  };

  const loadLabelData = async (data: ExportedLabelTemplate) => {
    undo.paused = true;
    onUpdateLabelProps(data.label);
    if (data.csv) {
      $csvData = data.csv;
      csvEnabled = true;
    }
    await FileUtils.loadCanvasState(fabricCanvas!, data.canvas);
    renderOnFontsChanged();
    undo.paused = false;
  };

  undo.onLabelUpdate = loadLabelData;
  undo.onStateUpdate = (state: UndoState) => {
    undoState = state;
  };

  const deleteSelected = () => {
    LabelDesignerUtils.deleteSelection(fabricCanvas!);
    discardSelection();
  };

  const cloneSelected = () => {
    LabelDesignerUtils.cloneSelection(fabricCanvas!).then(() => undo.push(fabricCanvas!, labelProps));
  };

  const moveSelected = (direction: MoveDirection, ctrl?: boolean) => {
    LabelDesignerUtils.moveSelection(fabricCanvas!, direction, ctrl);
    undo.push(fabricCanvas!, labelProps);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const key: string = e.key.toLowerCase();
    // windows and linux users are used to ctrl, mac users use cmd
    const cmdOrCtrl = e.metaKey || e.ctrlKey;

    // Esc
    if (key === "escape") {
      discardSelection();
      return;
    }

    if (LabelDesignerUtils.isAnyInputFocused(fabricCanvas!)) {
      return;
    }

    // Arrows
    if (key.startsWith("arrow")) {
      moveSelected(key.slice("arrow".length) as MoveDirection, cmdOrCtrl);
      return;
    }

    if (e.repeat) {
      return;
    }

    // Ctrl + D
    if (cmdOrCtrl && key === "d") {
      e.preventDefault();
      cloneSelected();
      return;
    }

    // Ctrl + Y, Ctrl + Shift + Z
    if ((cmdOrCtrl && key === "y") || (cmdOrCtrl && e.shiftKey && key === "z")) {
      e.preventDefault();
      if (!undoState.redoDisabled) {
        undo.redo();
      }
      return;
    }

    // Ctrl + Z
    if (cmdOrCtrl && key === "z") {
      e.preventDefault();
      if (!undoState.undoDisabled) {
        undo.undo();
      }
      return;
    }

    // Del
    if (key === "delete" || key === "backspace") {
      deleteSelected();
      return;
    }
  };

  const onUpdateLabelProps = (newProps: LabelProps) => {
    labelProps = newProps;
    fabricCanvas!.setDimensions(labelProps.size);
    fitToScreen();
    try {
      LocalStoragePersistence.saveLastLabelProps(labelProps);
      undo.push(fabricCanvas!, labelProps);
    } catch (e) {
      Toasts.zodErrors(e, "Label parameters save error:");
    }
  };

  const exportCurrentLabel = (): ExportedLabelTemplate => {
    return FileUtils.makeExportedLabel(fabricCanvas!, labelProps, csvEnabled);
  };

  const onLoadRequested = (label: ExportedLabelTemplate) => {
    loadLabelData(label).then(() => undo.push(fabricCanvas!, labelProps));
  };

  const zplImageReady = async (img: Blob) => {
    await LabelDesignerObjectHelper.addImageBlob(fabricCanvas!, img);
    undo.push(fabricCanvas!, labelProps);
  };

  const pdfImageReady = async (el: HTMLCanvasElement) => {
    const img = new fabric.FabricImage(el, {
      ...OBJECT_DEFAULTS,
      left: 0,
      top: 0,
    });

    fabricCanvas!.add(img);
    fabricCanvas!.setActiveObject(img);
    undo.push(fabricCanvas!, labelProps);
  };

  const onObjectPicked = (objectType: OjectType) => {
    const obj = LabelDesignerObjectHelper.addObject(fabricCanvas!, objectType);
    if (obj !== undefined) {
      fabricCanvas!.setActiveObject(obj);
      undo.push(fabricCanvas!, labelProps);
    }
  };

  const onIconPicked = (i: MaterialIcon) => {
    // todo: icon is not vertically centered
    LabelDesignerObjectHelper.addStaticText(fabricCanvas!, String.fromCodePoint(iconCodepoints[i]), {
      fontFamily: "Material Icons",
      fontSize: 100,
    });
    undo.push(fabricCanvas!, labelProps);
  };

  const onSvgIconPicked = async (i: string) => {
    const obj = await LabelDesignerObjectHelper.addSvg(fabricCanvas!, i);
    fabricCanvas!.setActiveObject(obj);
    undo.push(fabricCanvas!, labelProps);
  };

  /** Icons (material icons, svg and images) can be swapped for another one, keeping position and size */
  const isIconLike = (o: fabric.FabricObject): boolean =>
    (o instanceof fabric.FabricText && !(o instanceof fabric.IText) && o.fontFamily === "Material Icons") ||
    (o instanceof fabric.Group && !(o instanceof fabric.ActiveSelection)) ||
    o instanceof fabric.Path ||
    o instanceof fabric.FabricImage;

  const editKind = (o: fabric.FabricObject): "text" | "icon" | undefined => {
    if (o instanceof fabric.IText) return "text";
    if (isIconLike(o)) return "icon";
    return undefined;
  };

  let multiSelect = $state<boolean>(false);

  $effect(() => {
    if (fabricCanvas) fabricCanvas.multiSelect = multiSelect;
  });

  const finishEditing = () => {
    multiSelect = false;
    discardSelection();
  };

  const scaleToLabel = () => {
    if (!selectedObject) return;
    fabricCanvas!.scaleToLabel(selectedObject);
    controlValueUpdated();
  };

  const alignSelection = (how: Parameters<CustomCanvas["alignSelection"]>[0]) => {
    fabricCanvas!.alignSelection(how);
    undo.push(fabricCanvas!, labelProps);
    editRevision++;
  };

  const selectAll = () => {
    const objects = fabricCanvas!.getObjects();
    if (objects.length === 0) return;
    fabricCanvas!.discardActiveObject();
    fabricCanvas!.setActiveObject(
      objects.length === 1 ? objects[0] : new fabric.ActiveSelection(objects, { canvas: fabricCanvas }),
    );
    fabricCanvas!.requestRenderAll();
  };

  /** Moves the whole selection to the middle of the label */
  const centerSelection = (axis: "h" | "v") => {
    const sel = fabricCanvas!.getActiveObject();
    if (!sel) return;
    if (axis === "h") fabricCanvas!.centerObjectH(sel);
    else fabricCanvas!.centerObjectV(sel);
    sel.setCoords();
    fabricCanvas!.requestRenderAll();
    undo.push(fabricCanvas!, labelProps);
    editRevision++;
  };

  let textEditShow = $state<boolean>(false);
  let textEditTarget = $state<fabric.IText>();
  let textEditValue = $state<string>("");

  const openTextEdit = (t: fabric.IText) => {
    textEditTarget = t;
    textEditValue = t.text;
    textEditShow = true;
  };

  const saveTextEdit = () => {
    if (textEditTarget) {
      textEditTarget.set({ text: textEditValue });
      remeasureText(textEditTarget);
      undo.push(fabricCanvas!, labelProps);
      editRevision++;
    }
  };

  const focusOnOpen = (el: HTMLTextAreaElement) => {
    // after the modal animation, so the keyboard opens on phones
    setTimeout(() => {
      el.focus();
      el.select();
    }, 350);
  };

  /** Opens the "replace" icon picker in the settings bar */
  const openIconReplace = (o: fabric.FabricObject) => {
    if (fabricCanvas!.getActiveObject() !== o) fabricCanvas!.setActiveObject(o);
    // wait for the settings bar to render, and for the tap to finish so it does not close the menu again
    setTimeout(async () => {
      await tick();
      const btn = document.querySelector(".replace-icon [data-bs-toggle='dropdown']");
      if (btn) Dropdown.getOrCreateInstance(btn).show();
    }, 150);
  };

  const requestEdit = (o: fabric.FabricObject) => {
    const kind = editKind(o);
    if (kind === "text") openTextEdit(o as fabric.IText);
    else if (kind === "icon") openIconReplace(o);
  };

  /** Put `newObj` exactly where `oldObj` was (same center, fits the same box) and remove `oldObj` */
  const replaceKeepingLayout = (oldObj: fabric.FabricObject, newObj: fabric.FabricObject) => {
    const canvas = fabricCanvas!;
    const center = oldObj.getCenterPoint();
    const index = canvas.getObjects().indexOf(oldObj);

    if (oldObj instanceof fabric.FabricText && newObj instanceof fabric.FabricText) {
      newObj.set({ fontSize: oldObj.fontSize, scaleX: oldObj.scaleX, scaleY: oldObj.scaleY, fill: oldObj.fill });
    } else {
      const scale = Math.min(oldObj.getScaledWidth() / newObj.width, oldObj.getScaledHeight() / newObj.height);
      newObj.set({ scaleX: scale, scaleY: scale });
    }
    newObj.set({ angle: oldObj.angle, flipX: oldObj.flipX, flipY: oldObj.flipY });
    newObj.setPositionByOrigin(center, "center", "center");
    newObj.setCoords();

    undo.paused = true;
    canvas.remove(oldObj);
    canvas.moveObjectTo(newObj, Math.max(0, index));
    undo.paused = false;

    canvas.setActiveObject(newObj);
    canvas.requestRenderAll();
    undo.push(canvas, labelProps);

    document
      .querySelectorAll(".replace-icon [data-bs-toggle='dropdown']")
      .forEach((el) => Dropdown.getOrCreateInstance(el).hide());
  };

  const onReplaceIconPicked = (i: MaterialIcon) => {
    const old = selectedObject;
    if (!old) return;
    const obj = LabelDesignerObjectHelper.addStaticText(fabricCanvas!, String.fromCodePoint(iconCodepoints[i]), {
      fontFamily: "Material Icons",
      fontSize: 100,
    });
    replaceKeepingLayout(old, obj);
  };

  const onReplaceSvgPicked = async (data: string) => {
    const old = selectedObject;
    if (!old) return;
    const obj = await LabelDesignerObjectHelper.addSvg(fabricCanvas!, data);
    replaceKeepingLayout(old, obj);
  };

  const fitToScreen = () => {
    fabricCanvas?.fitToArea(stageEl);
    if ((fabricCanvas?.getVirtualZoom() ?? 1) > 3) {
      fabricCanvas?.virtualZoom(3);
    }
  };

  const openPreview = () => {
    printNow = false;
    previewOpened = true;
  };

  const openPreviewAndPrint = () => {
    printNow = true;
    previewOpened = true;
  };

  const controlValueUpdated = () => {
    if (selectedObject) {
      selectedObject.setCoords();
      selectedObject.dirty = true;
      undo.push(fabricCanvas!, labelProps);
    }
    fabricCanvas!.requestRenderAll();

    // trigger reactivity for controls
    editRevision++;
  };

  const getCanvasForPreview = (): FabricJson => {
    return fabricCanvas!.toJSON();
  };

  const onCsvPlaceholderPicked = (name: string) => {
    const obj = LabelDesignerObjectHelper.addText(fabricCanvas!, `{${name}}`, {
      textAlign: "left",
      originX: "left",
      originY: "top",
    });
    fabricCanvas!.setActiveObject(obj);
    undo.push(fabricCanvas!, labelProps);
  };

  const onPaste = async (event: ClipboardEvent) => {
    if (LabelDesignerUtils.isAnyInputFocused(fabricCanvas!)) {
      return;
    }

    const openedDropdowns = document.querySelectorAll(".dropdown-menu.show");
    if (openedDropdowns.length > 0) {
      return;
    }

    if (event.clipboardData != null) {
      event.preventDefault();
      const obj = await LabelDesignerObjectHelper.addObjectFromClipboard(fabricCanvas!, event.clipboardData);

      if (obj !== undefined) {
        fabricCanvas!.setActiveObject(obj);
        undo.push(fabricCanvas!, labelProps);
      }
    }
  };

  const clearCanvas = () => {
    if (!confirm($tr("editor.clear.confirm"))) {
      return;
    }
    undo.push(fabricCanvas!, labelProps);
    fabricCanvas!.clear();
  };

  const toggleGrid = () => {
    const newVal = !$appConfig.gridEnabled;
    appConfig.update((cfg) => ({ ...cfg, gridEnabled: newVal }));
    fabricCanvas?.setGridEnabled(newVal);
  };

  const loadLabelFromUrl = async () => {
    try {
      const urlTemplate = await FileUtils.readLabelFromUrl();

      if (urlTemplate !== null && confirm($tr("params.saved_labels.load.url.warn"))) {
        onLoadRequested(urlTemplate);
        Toasts.message($tr("params.saved_labels.load.url.loaded"));
        return true;
      }
    } catch (e) {
      Toasts.error(e);
    }
    return false;
  }

  const loadDefaultLabel = async () => {
    const urlLoaded = await loadLabelFromUrl();

    if (urlLoaded) {
      return;
    }

    try {
      const defaultTemplate = LocalStoragePersistence.loadDefaultTemplate();

      if (defaultTemplate !== null) {
        onLoadRequested(defaultTemplate);
        return;
      }
    } catch (e) {
      Toasts.error(e);
    }

    LabelDesignerObjectHelper.addText(fabricCanvas!, $tr("editor.default_text"));
  };

  /** Measure texts again once their font is loaded, otherwise letters overlap or have gaps */
  const renderOnFontsChanged = () => {
    fabricCanvas?.forEachObject((o) => {
      if (o instanceof fabric.FabricText) {
        ensureFontReady(o);
      }
    });
    fabricCanvas?.requestRenderAll();
  };

  onMount(async () => {
    try {
      const savedLabelProps = LocalStoragePersistence.loadLastLabelProps();
      if (savedLabelProps !== null) {
        labelProps = savedLabelProps;
      }
    } catch (e) {
      Toasts.zodErrors(e, "Label parameters load error:");
    }

    fabricCanvas = new CustomCanvas(htmlCanvas, {
      width: labelProps.size.width,
      height: labelProps.size.height,
    });
    fabricCanvas.setLabelProps(labelProps);
    fabricCanvas.editKind = editKind;
    fabricCanvas.onEditRequest = requestEdit;
    fabricCanvas.onZoomChange = (z) => {
      zoomText = Math.round(z * 100) + "%";
    };
    fabricCanvas.setGridEnabled(!!$appConfig.gridEnabled);
    fabricCanvas.bindGestures(stageEl);
    fitToScreen();

    await loadDefaultLabel();

    window.addEventListener("hashchange", loadLabelFromUrl);

    undo.push(fabricCanvas, labelProps);

    // force close dropdowns on touch devices
    fabricCanvas.on("mouse:down", (): void => {
      const dropdowns = document.querySelectorAll("[data-bs-toggle='dropdown']");
      dropdowns.forEach((el) => new Dropdown(el).hide());
    });

    // long press or double tap on a text or icon: change it right away
    let longPressTimer: ReturnType<typeof setTimeout> | undefined;
    let longPressStart: fabric.Point | undefined;
    const cancelLongPress = () => {
      clearTimeout(longPressTimer);
      longPressTimer = undefined;
    };

    fabricCanvas.on("mouse:down", (e): void => {
      cancelLongPress();
      const target = e.target;
      if (!target || editKind(target) === undefined) return;
      longPressStart = fabricCanvas!.getViewportPoint(e.e);
      longPressTimer = setTimeout(() => {
        longPressTimer = undefined;
        requestEdit(target);
      }, 550);
    });

    fabricCanvas.on("mouse:move", (e): void => {
      if (!longPressTimer || !longPressStart) return;
      const p = fabricCanvas!.getViewportPoint(e.e);
      if (p.distanceFrom(longPressStart) > 10 / fabricCanvas!.getVirtualZoom()) cancelLongPress();
    });

    fabricCanvas.on("mouse:up", cancelLongPress);

    fabricCanvas.on("mouse:dblclick", (e): void => {
      cancelLongPress();
      if (e.target) requestEdit(e.target);
    });

    // typing inside the canvas is awkward on phones, use the text window instead
    fabricCanvas.on("text:editing:entered", (e): void => {
      const t = e.target;
      t.exitEditing();
      openTextEdit(t);
    });

    fabricCanvas.on("object:moving", (e): void => {
      if (e.target && e.target.left !== undefined && e.target.top !== undefined) {
        e.target.set({
          left: Math.round(e.target.left / GRID_SIZE) * GRID_SIZE,
          top: Math.round(e.target.top / GRID_SIZE) * GRID_SIZE,
        });
      }
    });

    fabricCanvas.on("object:modified", (): void => {
      undo.push(fabricCanvas!, labelProps);
    });

    fabricCanvas.on("text:changed", () => {
      editRevision++;
    });

    fabricCanvas.on("object:removed", (): void => {
      undo.push(fabricCanvas!, labelProps);
    });

    fabricCanvas.on("selection:created", (e): void => {
      selectedCount = e.selected?.length ?? 0;
      selectedObject = e.selected?.length === 1 ? e.selected[0] : undefined;
      editRevision++;
    });

    fabricCanvas.on("selection:updated", (e): void => {
      selectedCount = e.selected?.length ?? 0;
      selectedObject = e.selected?.length === 1 ? e.selected[0] : undefined;
      editRevision++;
    });

    fabricCanvas.on("selection:cleared", (): void => {
      selectedObject = undefined;
      selectedCount = 0;
      editRevision++;
    });

    fabricCanvas.on("dragover", (e): void => {
      e.e.preventDefault();
    });

    fabricCanvas.on("drop:after", async (e): Promise<void> => {
      const dragEvt = e.e as DragEvent;
      dragEvt.preventDefault();

      let dropped = false;

      if (dragEvt.dataTransfer?.files) {
        for (const file of dragEvt.dataTransfer.files) {
          try {
            await LabelDesignerObjectHelper.addImageFile(fabricCanvas!, file);
            dropped = true;
          } catch (e) {
            Toasts.error(e);
          }
        }

        if (dropped) {
          undo.push(fabricCanvas!, labelProps);
        }
      }
    });

    fabricCanvas.on("object:scaling", (e): void => {
      if (!e.target) {
        return;
      }

      CanvasUtils.fixFabricObjectScale(e.target);
    });

    // userFonts.subscribe((e) => {console.log(e); renderOnFontsChanged();});

    if ($automation !== undefined) {
      if ($automation.startPrint !== undefined) {
        if ($automation.startPrint === "immediately") {
          openPreview();
        } else if ($automation.startPrint === "after_connect") {
          const unsubscribe = connectionState.subscribe((st) => {
            if (st === "connected") {
              tick().then(() => unsubscribe());
              openPreviewAndPrint();
            }
          });
        }
      }
    }
  });

  onDestroy(() => {
    fabricCanvas!.dispose();
    window.removeEventListener("hashchange", loadLabelFromUrl);
  });

  $effect(() => {
    fabricCanvas?.setLabelProps(labelProps);
  });

  $effect(() => {
    if (!previewOpened) {
      printNow = false;
    }
  });

  $effect(() => {
    if ($loadedFonts) {
      renderOnFontsChanged();
    }
  });
</script>

<svelte:window bind:innerWidth={windowWidth} onkeydown={onKeyDown} onpaste={onPaste} />

<div class="designer">
  <nav class="np-toolbar np-tabs">
    <LabelPropsEditor {labelProps} onChange={onUpdateLabelProps} label={$tr("ui.tool.label")} />

    <TemplatesMenu {labelProps} {onLoadRequested} onRequestLabelTemplate={exportCurrentLabel} label={$tr("ui.tool.templates")} />

    <SavedLabelsMenu
      canvas={fabricCanvas!}
      onRequestLabelTemplate={exportCurrentLabel}
      {onLoadRequested}
      {csvEnabled}
      label={$tr("ui.tool.saved")} />

    <CsvControl bind:enabled={csvEnabled} onPlaceholderPicked={onCsvPlaceholderPicked} label={$tr("ui.tool.data")} />
  </nav>

  <section class="canvas-card">
    <div class="card-head">
      <span class="card-title">{$tr("ui.tool.label")} · {sizeText}</span>
      <button class="btn round-btn" onclick={clearCanvas} title={$tr("editor.clear")}>
        <MdIcon icon="delete_outline" />
      </button>
    </div>

    <div class="stage-holder">
      <div class="canvas-wrapper stage" bind:this={stageEl}>
        <div class="label-frame print-start-{labelProps.printDirection}">
          <canvas bind:this={htmlCanvas}></canvas>
        </div>
      </div>
    </div>

    <div class="stage-controls">
      <div class="pill">
        <button class="btn" disabled={undoState.undoDisabled} onclick={() => undo.undo()} title={$tr("editor.undo")}>
          <MdIcon icon="undo" />
        </button>
        <button class="btn" disabled={undoState.redoDisabled} onclick={() => undo.redo()} title={$tr("editor.redo")}>
          <MdIcon icon="redo" />
        </button>
      </div>

      <div class="pill">
        <button class="btn {$appConfig.gridEnabled ? 'active' : ''}" onclick={toggleGrid} title={$tr("editor.grid")}>
          <MdIcon icon="grid_on" />
        </button>
        <button class="btn" onclick={() => fabricCanvas?.virtualZoomOut()} title={$tr("ui.zoom.out")}>
          <MdIcon icon="zoom_out" />
        </button>
        <button class="btn zoom-text" onclick={() => fabricCanvas?.resetVirtualZoom()} title="Reset zoom">
          {zoomText}
        </button>
        <button class="btn" onclick={() => fabricCanvas?.virtualZoomIn()} title={$tr("ui.zoom.in")}>
          <MdIcon icon="zoom_in" />
        </button>
        <button class="btn" onclick={fitToScreen} title={$tr("ui.zoom.fit")}>
          <MdIcon icon="fit_screen" />
        </button>
      </div>
    </div>
  </section>

  <section class="sheet">
    <div class="sheet-handle"></div>

    {#if selectedCount > 0}
      <div class="sheet-head">
        <h2>
          {$tr("ui.sheet.edit")}
          {#if selectedCount > 1}<span class="selected-count">{selectedCount}</span>{/if}
        </h2>
        <div class="sheet-head-tools">
          <button
            class="btn btn-sm sheet-toggle {multiSelect ? 'active' : ''}"
            onclick={() => (multiSelect = !multiSelect)}
            title={$tr("ui.multi_select.help")}>
            <MdIcon icon="library_add_check" />
            {$tr("ui.multi_select")}
          </button>
          <button class="btn btn-sm sheet-done" onclick={finishEditing}>
            <MdIcon icon="check" />
            {$tr("ui.sheet.done")}
          </button>
        </div>
      </div>

      <div class="sheet-row np-toolbar props-bar">
        <button class="btn btn-sm btn-danger" onclick={deleteSelected} title={$tr("editor.delete")}>
          <MdIcon icon="delete" />
        </button>

        <button class="btn btn-sm btn-secondary" onclick={cloneSelected} title={$tr("editor.clone")}>
          <MdIcon icon="content_copy" />
        </button>

        {#if selectedObject instanceof fabric.IText && selectedCount === 1}
          <button class="btn btn-sm btn-secondary" onclick={() => openTextEdit(selectedObject as fabric.IText)}>
            <MdIcon icon="edit" />
            <span class="tool-label">{$tr("ui.text_edit.button")}</span>
          </button>
        {/if}

        {#if multiSelect}
          <button class="btn btn-sm btn-secondary" onclick={selectAll}>
            <MdIcon icon="select_all" />
            <span class="tool-label">{$tr("ui.select_all")}</span>
          </button>
        {/if}

        {#if selectedObject && selectedCount === 1}
          <button class="btn btn-sm btn-secondary" onclick={scaleToLabel} title={$tr("ui.scale_to_label.help")}>
            <MdIcon icon="crop_free" />
            <span class="tool-label">{$tr("ui.scale_to_label")}</span>
          </button>
        {/if}

        {#if selectedCount > 1}
          <div class="tool-group">
            <button class="btn btn-sm btn-secondary" onclick={() => centerSelection("v")} title={$tr("params.generic.center.vertical")}>
              <MdIcon icon="vertical_distribute" />
            </button>
            <button class="btn btn-sm btn-secondary" onclick={() => centerSelection("h")} title={$tr("params.generic.center.horizontal")}>
              <MdIcon icon="horizontal_distribute" />
            </button>
          </div>
          <div class="tool-group">
            <button class="btn btn-sm btn-secondary" onclick={() => alignSelection("left")} title={$tr("ui.align.left")}>
              <MdIcon icon="align_horizontal_left" />
            </button>
            <button class="btn btn-sm btn-secondary" onclick={() => alignSelection("center_h")} title={$tr("ui.align.center_h")}>
              <MdIcon icon="align_horizontal_center" />
            </button>
            <button class="btn btn-sm btn-secondary" onclick={() => alignSelection("right")} title={$tr("ui.align.right")}>
              <MdIcon icon="align_horizontal_right" />
            </button>
            <button class="btn btn-sm btn-secondary" onclick={() => alignSelection("top")} title={$tr("ui.align.top")}>
              <MdIcon icon="align_vertical_top" />
            </button>
            <button class="btn btn-sm btn-secondary" onclick={() => alignSelection("center_v")} title={$tr("ui.align.center_v")}>
              <MdIcon icon="align_vertical_center" />
            </button>
            <button class="btn btn-sm btn-secondary" onclick={() => alignSelection("bottom")} title={$tr("ui.align.bottom")}>
              <MdIcon icon="align_vertical_bottom" />
            </button>
          </div>
        {/if}

        {#if selectedObject && selectedCount === 1 && isIconLike(selectedObject)}
          <div class="replace-icon">
            <IconPicker onSubmit={onReplaceIconPicked} onSubmitSvg={onReplaceSvgPicked} label={$tr("ui.replace")} />
          </div>
        {/if}

        {#if selectedObject && selectedCount === 1}
          <GenericObjectParamsControls {selectedObject} {editRevision} valueUpdated={controlValueUpdated} />
        {/if}

        {#if selectedObject}
          <VectorParamsControls {selectedObject} {editRevision} valueUpdated={controlValueUpdated} />
        {/if}

        {#if selectedObject instanceof fabric.IText}
          <TextParamsControls selectedText={selectedObject} {editRevision} valueUpdated={controlValueUpdated} />
        {/if}

        {#if selectedObject instanceof QRCode}
          <QrCodeParamsPanel selectedQRCode={selectedObject} {editRevision} valueUpdated={controlValueUpdated} />
        {/if}

        {#if selectedObject instanceof ArUcoMarker}
          <ArUcoParamsPanel selectedArUco={selectedObject} {editRevision} valueUpdated={controlValueUpdated} />
        {/if}

        {#if selectedObject instanceof Barcode}
          <BarcodeParamsPanel selectedBarcode={selectedObject} {editRevision} valueUpdated={controlValueUpdated} />
        {/if}

        {#if selectedObject instanceof fabric.IText || selectedObject instanceof QRCode || (selectedObject instanceof Barcode && selectedObject.encoding === "CODE128B")}
          <VariableInsertControl {selectedObject} valueUpdated={controlValueUpdated} />
        {/if}
      </div>
    {:else}
      <div class="sheet-head">
        <h2>{$tr("ui.sheet.add")}</h2>
        <span class="sheet-hint">{$tr("ui.selection.hint")}</span>
      </div>

      <div class="sheet-row add-grid">
        <button class="btn btn-sm btn-secondary" onclick={() => onObjectPicked("text")}>
          <MdIcon icon="title" />
          <span class="tool-label">{$tr("editor.objectpicker.text")}</span>
        </button>

        <IconPicker onSubmit={onIconPicked} onSubmitSvg={onSvgIconPicked} label={$tr("ui.tool.icon")} />

        <button class="btn btn-sm btn-secondary" onclick={() => onObjectPicked("image")}>
          <MdIcon icon="image" />
          <span class="tool-label">{$tr("editor.objectpicker.image")}</span>
        </button>

        <div class="dropdown">
          <button class="btn btn-sm btn-secondary" data-bs-toggle="dropdown">
            <MdIcon icon="category" />
            <span class="tool-label">{$tr("ui.tool.shape")}</span>
          </button>
          <div class="dropdown-menu shape-menu p-2">
            <button class="btn" onclick={() => onObjectPicked("rectangle")}>
              <MdIcon icon="crop_square" />
              {$tr("editor.objectpicker.rectangle")}
            </button>
            <button class="btn" onclick={() => onObjectPicked("circle")}>
              <MdIcon icon="radio_button_unchecked" />
              {$tr("editor.objectpicker.circle")}
            </button>
            <button class="btn" onclick={() => onObjectPicked("line")}>
              <MdIcon icon="remove" />
              {$tr("editor.objectpicker.line")}
            </button>
          </div>
        </div>

        <button class="btn btn-sm btn-secondary" onclick={() => onObjectPicked("qrcode")}>
          <MdIcon icon="qr_code_2" />
          <span class="tool-label">{$tr("editor.objectpicker.qrcode")}</span>
        </button>

        <button class="btn btn-sm btn-secondary" onclick={() => onObjectPicked("barcode")}>
          <MdIcon icon="view_week" />
          <span class="tool-label">{$tr("editor.objectpicker.barcode")}</span>
        </button>

        <ObjectPicker onSubmit={onObjectPicked} {labelProps} {zplImageReady} {pdfImageReady} label={$tr("ui.tool.more")} />

        <button class="btn btn-sm btn-secondary" onclick={openPreview}>
          <MdIcon icon="visibility" />
          <span class="tool-label">{$tr("editor.preview")}</span>
        </button>
      </div>
    {/if}

    <button
      class="print-bar"
      onclick={openPreviewAndPrint}
      disabled={$connectionState !== "connected"}>
      <MdIcon icon="print" />
      <span>{$connectionState === "connected" ? $tr("editor.print") : $tr("ui.print.connect_first")}</span>
      <span class="print-arrow"><MdIcon icon="arrow_forward" /></span>
    </button>
  </section>

  {#if previewOpened}
    <PrintPreview
      bind:show={previewOpened}
      canvasCallback={getCanvasForPreview}
      {labelProps}
      {printNow}
      {csvEnabled}
      csvData={$csvData.data} />
  {/if}

  {#if textEditShow}
    <AppModal title={$tr("ui.text_edit.title")} bind:show={textEditShow}>
      <textarea class="form-control text-edit" rows="3" bind:value={textEditValue} use:focusOnOpen></textarea>

      {#snippet footer()}
        <!-- closed by bootstrap, so the closing animation can finish before the window is removed -->
        <button class="btn btn-secondary" data-bs-dismiss="modal">{$tr("ui.cancel")}</button>
        <button class="btn btn-primary" data-bs-dismiss="modal" onclick={saveTextEdit}>{$tr("ui.save")}</button>
      {/snippet}
    </AppModal>
  {/if}
</div>

<style>
  .designer {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: 100%;
    min-height: 0;
  }

  .canvas-card {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    gap: 10px;
    min-height: 0;
    padding: 8px 10px 10px;
    border-radius: 24px;
    background: var(--np-card);
  }

  .card-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding-left: 6px;
  }

  .card-title {
    color: var(--np-muted);
    font-size: 0.95rem;
  }

  .round-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--np-raised);
    color: var(--bs-body-color);
    font-size: 1.25rem;
  }

  .stage-holder {
    position: relative;
    flex: 1 1 auto;
    min-height: 100px;
    border-radius: 18px;
    overflow: hidden;
    background-color: var(--np-stage-bg);
    background-image: radial-gradient(var(--np-stage-dot) 1px, transparent 1px);
    background-size: 16px 16px;
  }

  /* only this element scrolls and zooms, the rest of the page stays in place */
  .stage {
    position: absolute;
    inset: 0;
    overflow: auto;
    display: flex;
    padding: 20px;
    touch-action: none;
    scrollbar-width: thin;
    overscroll-behavior: contain;
  }

  .label-frame {
    margin: auto;
    flex: none;
    box-shadow: 0 6px 22px rgba(0, 0, 0, 0.45);
  }
  .label-frame.print-start-left {
    border-left: 5px solid var(--np-accent);
  }
  .label-frame.print-start-top {
    border-top: 5px solid var(--np-accent);
  }
  .label-frame canvas {
    image-rendering: pixelated;
    display: block;
  }

  .stage-controls {
    display: flex;
    justify-content: space-between;
    gap: 8px;
  }

  .pill {
    display: flex;
    align-items: center;
    gap: 0;
    padding: 4px;
    border-radius: 999px;
    background: var(--np-raised);
  }
  .pill .btn {
    min-width: 36px;
    height: 40px;
    padding: 0 6px;
    border: 0;
    border-radius: 999px;
    color: var(--bs-body-color);
    font-size: 1.2rem;
  }
  .pill .btn.active {
    color: var(--np-accent);
  }
  .zoom-text {
    min-width: 3.4em !important;
    font-size: 0.95rem !important;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }

  /* peach panel at the bottom, like a bottom sheet that is always open */
  .sheet {
    flex: none;
    margin: 0 -8px calc(-6px - env(safe-area-inset-bottom));
    padding: 6px 14px calc(12px + env(safe-area-inset-bottom));
    border-radius: 28px 28px 0 0;
    background: var(--np-accent);
    color: var(--np-ink);
  }

  .sheet-handle {
    width: 44px;
    height: 5px;
    margin: 0 auto 10px;
    border-radius: 3px;
    background: rgba(30, 31, 36, 0.25);
  }

  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    min-height: 36px;
    margin-bottom: 8px;
  }
  .sheet-head h2 {
    margin: 0;
    font-size: 1.35rem;
    font-weight: 700;
    color: var(--np-ink);
  }

  .sheet-hint {
    color: rgba(30, 31, 36, 0.7);
    font-size: 0.85rem;
    text-align: right;
  }

  .tool-group {
    display: flex;
    flex: none;
    gap: 4px;
    padding-left: 6px;
    border-left: 1px solid rgba(255, 255, 255, 0.15);
  }

  .sheet-head-tools {
    display: flex;
    gap: 6px;
  }

  .selected-count {
    display: inline-block;
    min-width: 1.6em;
    margin-left: 4px;
    padding: 0 6px;
    border-radius: 999px;
    background: var(--np-ink);
    color: var(--np-accent);
    font-size: 0.9rem;
    text-align: center;
    vertical-align: middle;
  }

  .sheet-toggle {
    align-self: center;
    border: 2px solid var(--np-ink);
    border-radius: 999px;
    color: var(--np-ink);
    font-weight: 600;
  }

  .sheet-toggle.active {
    background: var(--np-ink);
    color: var(--np-accent);
  }

  .sheet-done {
    align-self: center;
    border-radius: 999px;
    background: var(--np-ink);
    color: var(--np-accent);
    font-weight: 600;
  }

  /* same height with and without a selection, so the label does not jump */
  .sheet-row {
    height: 68px;
  }

  /* wide screens wrap the settings instead of swiping */
  @media (min-width: 768px) {
    .props-bar.sheet-row {
      height: auto;
      min-height: 68px;
    }
  }

  .props-bar {
    padding: 4px 8px;
    border-radius: 16px;
    background: var(--np-card);
    color: var(--bs-body-color);
  }

  .text-edit {
    font-size: 1.2rem;
  }

  .shape-menu .btn {
    display: block;
    width: 100%;
    text-align: start;
  }

  .print-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    margin-top: 10px;
    padding: 12px 20px;
    border: 0;
    border-radius: 18px;
    background: var(--np-ink);
    color: #fff;
    font-size: 1.15rem;
    font-weight: 600;
  }
  .print-bar :global(.mdi) {
    color: var(--np-accent);
    font-size: 1.5rem;
  }
  .print-bar:disabled {
    color: rgba(255, 255, 255, 0.6);
  }
  .print-arrow {
    margin-left: auto;
  }
</style>
