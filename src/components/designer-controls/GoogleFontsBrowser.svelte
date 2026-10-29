<script lang="ts">
  import { onMount } from "svelte";
  import AppModal from "$/components/basic/AppModal.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { userFonts } from "$/stores";
  import {
    fetchGoogleFontsCatalog,
    installGoogleFont,
    previewCssUrl,
    type GoogleFontCategory,
    type GoogleFontInfo,
  } from "$/utils/google_fonts";
  import { tr, type TranslationKey } from "$/utils/i18n";
  import { Toasts } from "$/utils/toasts";

  interface Props {
    show: boolean;
    /** Called after the font is downloaded and ready */
    onPicked?: (family: string) => void;
  }

  let { show = $bindable(), onPicked }: Props = $props();

  const PAGE_SIZE = 40;
  const categories: (GoogleFontCategory | "all")[] = ["all", "sans-serif", "serif", "display", "handwriting", "monospace"];

  let modal = $state<AppModal>();
  let catalog = $state<GoogleFontInfo[]>([]);
  let offline = $state<boolean>(false);
  let loading = $state<boolean>(true);
  let search = $state<string>("");
  let category = $state<GoogleFontCategory | "all">("all");
  let limit = $state<number>(PAGE_SIZE);
  let installing = $state<string>("");
  /** Preview stylesheets already added to the page, intentionally not reactive */
  // eslint-disable-next-line svelte/prefer-svelte-reactivity
  const previewLoaded = new Set<string>();

  let filtered = $derived.by(() => {
    const q = search.trim().toLowerCase();
    return catalog.filter((f) => (category === "all" || f.category === category) && (!q || f.family.toLowerCase().includes(q)));
  });

  let visible = $derived(filtered.slice(0, limit));

  let installed = $derived(new Set($userFonts.map((f) => f.family)));

  $effect(() => {
    if (offline) return;
    for (const f of visible) {
      if (previewLoaded.has(f.family)) continue;
      previewLoaded.add(f.family);
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = previewCssUrl(f.family);
      document.head.appendChild(link);
    }
  });

  $effect(() => {
    // new search starts from the first page
    void search;
    void category;
    limit = PAGE_SIZE;
  });

  const pick = async (font: GoogleFontInfo) => {
    if (installing) return;
    installing = font.family;
    try {
      await installGoogleFont(font);
      Toasts.message(`${$tr("fonts.google.added")}: ${font.family}`);
      onPicked?.(font.family);
      modal?.hide();
    } catch (e) {
      Toasts.error(e);
    } finally {
      installing = "";
    }
  };

  onMount(async () => {
    const result = await fetchGoogleFontsCatalog();
    catalog = result.fonts;
    offline = result.offline;
    loading = false;
  });
</script>

<AppModal bind:this={modal} title={$tr("fonts.google.title")} bind:show dialogClass="modal-fullscreen-sm-down modal-dialog-scrollable">
  <input type="search" class="form-control mb-2" placeholder={$tr("fonts.google.search")} bind:value={search} />

  <div class="d-flex flex-wrap gap-1 mb-3">
    {#each categories as cat (cat)}
      <button
        class="btn btn-sm {category === cat ? 'btn-primary' : 'btn-outline-secondary'} rounded-pill"
        onclick={() => (category = cat)}>
        {$tr(`fonts.google.cat.${cat}` as TranslationKey)}
      </button>
    {/each}
  </div>

  {#if offline}
    <div class="alert alert-warning py-2">{$tr("fonts.google.offline")}</div>
  {/if}

  {#if loading}
    <div class="text-center py-4"><div class="spinner-border text-secondary"></div></div>
  {:else}
    <div class="list-group">
      {#each visible as font (font.family)}
        <button
          class="list-group-item list-group-item-action d-flex align-items-center gap-2"
          disabled={!!installing}
          onclick={() => pick(font)}>
          <span class="font-name" style="font-family: '{font.family}', sans-serif">{font.family}</span>
          {#if installing === font.family}
            <span class="spinner-border spinner-border-sm ms-auto"></span>
          {:else if installed.has(font.family)}
            <MdIcon icon="check" class="ms-auto text-success" />
          {:else}
            <MdIcon icon="download" class="ms-auto text-secondary" />
          {/if}
        </button>
      {/each}
    </div>

    {#if filtered.length > limit}
      <button class="btn btn-outline-secondary w-100 mt-2" onclick={() => (limit += PAGE_SIZE)}>
        {$tr("fonts.google.more")} ({filtered.length - limit})
      </button>
    {/if}
  {/if}
</AppModal>

<style>
  .font-name {
    font-size: 1.35rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
