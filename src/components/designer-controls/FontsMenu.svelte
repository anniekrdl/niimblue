<script lang="ts">
  import AppModal from "$/components/basic/AppModal.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { userFonts } from "$/stores";
  import { FileUtils } from "$/utils/file_utils";
  import { tr } from "$/utils/i18n";
  import { LocalStoragePersistence } from "$/utils/persistence";
  import { Toasts } from "$/utils/toasts";

  let show = $state<boolean>(false);
  let usedSpace = $state<number>(0);
  let selectExt = $state<"ttf" | "woff2">("ttf");
  let overrideFamily = $state<string>("");

  const calcUsedSpace = () => {
    usedSpace = LocalStoragePersistence.usedSpace();
  };

  const browseFont = async () => {
    const result = await FileUtils.pickAndReadBinaryFile(selectExt);

    let fontName = result.name.split(".")[0];
    const mime = `text/${selectExt}`;

    if (overrideFamily.trim() !== "") {
      fontName = overrideFamily.trim();
    }

    if ($userFonts.some((e) => e.family == fontName)) {
      Toasts.error(`${fontName} already loaded`);
      return;
    }

    const compressed = await FileUtils.compressData(result.data);
    const b64data = await FileUtils.base64buf(compressed);

    userFonts.update((prev) => [...prev, { gzippedDataB64: b64data, family: fontName, mimeType: mime }]);

    calcUsedSpace();
    overrideFamily = "";
  };

  const removeFont = (family: string) => {
    userFonts.update((prev) => prev.filter((e) => e.family !== family));
    calcUsedSpace();
  };

  $effect(() => {
    if (show) calcUsedSpace();
  });
</script>

<button
  class="btn btn-outline-secondary"
  onclick={() => {
    show = true;
  }}>
  <MdIcon icon="settings" />
</button>

{#if show}
  <AppModal title={$tr("fonts.title")} bind:show>
    <div class="mb-1">
      {#each $userFonts as font (font.family)}
        <div class="font-row">
          <span class="font-name" style="font-family: {font.family}">{font.family}</span>
          <button class="btn btn-sm btn-outline-danger" onclick={() => removeFont(font.family)}>
            <MdIcon icon="delete" />
          </button>
        </div>
      {:else}
        👀
      {/each}
    </div>

    <hr />

    <div class="text-secondary mb-2">{$tr("fonts.add")}</div>

    <div class="d-flex gap-2 mb-2">
      <select class="form-select type-select" bind:value={selectExt}>
        <option value="ttf">ttf</option>
        <option value="woff2">woff2</option>
      </select>

      <input type="text" class="form-control" placeholder={$tr("fonts.title_override")} bind:value={overrideFamily} />
    </div>

    <button class="btn btn-primary w-100" onclick={browseFont}>
      <MdIcon icon="upload_file" />
      {$tr("fonts.browse")}
    </button>

    {#snippet footer()}
      <div class="text-secondary">
        {usedSpace}
        {$tr("params.saved_labels.kb_used")} |
        <a class="text-secondary" href="https://fonts.google.com">{$tr("fonts.gfonts")}</a>
      </div>
    {/snippet}
  </AppModal>
{/if}

<style>
  .font-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-bottom: 1px solid var(--bs-border-color);
  }

  .font-name {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    font-size: 1.25rem;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .type-select {
    flex: none;
    width: 6.5em;
  }
</style>
