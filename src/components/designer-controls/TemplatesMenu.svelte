<script lang="ts">
  import AppModal from "$/components/basic/AppModal.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import type { ExportedLabelTemplate, LabelProps } from "$/types";
  import { BUILTIN_TEMPLATES, buildTemplate } from "$/utils/builtin_templates";
  import { tr } from "$/utils/i18n";
  import { LocalStoragePersistence } from "$/utils/persistence";
  import { Toasts } from "$/utils/toasts";

  interface Props {
    labelProps: LabelProps;
    onLoadRequested: (label: ExportedLabelTemplate) => void;
    onRequestLabelTemplate: () => ExportedLabelTemplate;
    label?: string;
  }

  let { labelProps, onLoadRequested, onRequestLabelTemplate, label }: Props = $props();

  let show = $state<boolean>(false);
  let builtins = $state<{ title: string; tpl: ExportedLabelTemplate }[]>([]);
  let savedLabels = $state<ExportedLabelTemplate[]>([]);
  let newTitle = $state<string>("");
  let modal = $state<AppModal>();

  const open = () => {
    try {
      // templates are generated for the current label size
      builtins = BUILTIN_TEMPLATES.map((t) => ({ title: $tr(t.title), tpl: buildTemplate(t, labelProps) }));
      savedLabels = LocalStoragePersistence.loadLabels();
    } catch (e) {
      Toasts.error(e);
    }
    show = true;
  };

  const load = (tpl: ExportedLabelTemplate) => {
    onLoadRequested(tpl);
    // let the modal finish its hide animation, it sets show to false itself
    modal?.hide();
  };

  const saveCurrent = () => {
    const tpl = onRequestLabelTemplate();
    tpl.title = newTitle.trim() || undefined;
    const labels = [...savedLabels, tpl];
    const { zodErrors, otherErrors } = LocalStoragePersistence.saveLabels(labels);
    zodErrors.forEach((e) => Toasts.zodErrors(e, "Label save error"));
    otherErrors.forEach((e) => Toasts.error(e));

    if (zodErrors.length === 0 && otherErrors.length === 0) {
      savedLabels = LocalStoragePersistence.loadLabels();
      newTitle = "";
      Toasts.message($tr("templates.saved"));
    }
  };
</script>

<button class="btn btn-sm btn-secondary" onclick={open}>
  <MdIcon icon="dashboard" />
  {#if label}<span class="tool-label">{label}</span>{/if}
</button>

{#if show}
  <AppModal bind:this={modal} title={$tr("templates.title")} bind:show dialogClass="modal-lg modal-fullscreen-sm-down modal-dialog-scrollable">
    <h6 class="text-secondary">{$tr("templates.builtin")}</h6>
    <div class="tpl-grid mb-4">
      {#each builtins as item (item.tpl.title)}
        <button class="tpl-tile" onclick={() => load(item.tpl)}>
          <span class="tpl-thumb"><img src={item.tpl.thumbnailBase64} alt={item.title} /></span>
          <span class="tpl-title">{item.title}</span>
        </button>
      {/each}
    </div>

    <h6 class="text-secondary">{$tr("templates.mine")}</h6>
    <div class="tpl-grid mb-3">
      {#each savedLabels as item, idx (item.id ?? idx)}
        <button class="tpl-tile" onclick={() => load(item)}>
          <span class="tpl-thumb">
            {#if item.thumbnailBase64}<img src={item.thumbnailBase64} alt={item.title} />{/if}
          </span>
          <span class="tpl-title">{item.title || $tr("templates.untitled")}</span>
        </button>
      {:else}
        <div class="text-secondary">{$tr("templates.mine.empty")}</div>
      {/each}
    </div>

    <div class="input-group">
      <input class="form-control" type="text" placeholder={$tr("templates.save.placeholder")} bind:value={newTitle} />
      <button class="btn btn-primary" onclick={saveCurrent}>
        <MdIcon icon="save" />
        {$tr("templates.save")}
      </button>
    </div>
  </AppModal>
{/if}

<style>
  .tpl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 10px;
  }

  .tpl-tile {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px;
    border: 1px solid var(--bs-border-color);
    border-radius: 12px;
    background: var(--np-surface);
    color: inherit;
    text-align: center;
  }
  .tpl-tile:hover,
  .tpl-tile:focus-visible {
    border-color: var(--bs-primary);
  }

  .tpl-thumb {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 84px;
    border-radius: 6px;
    background: white;
    overflow: hidden;
  }
  .tpl-thumb img {
    max-width: 100%;
    max-height: 100%;
  }

  .tpl-title {
    font-size: 0.9rem;
  }
</style>
