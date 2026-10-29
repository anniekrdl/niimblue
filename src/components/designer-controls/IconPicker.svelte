<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { tr } from "$/utils/i18n";
  import { iconCodepoints, type MaterialIcon } from "$/styles/mdi_icons";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { appConfig, userIcons } from "$/stores";
  import { FileUtils } from "$/utils/file_utils";
  import { Toasts } from "$/utils/toasts";
  import { iconFileToSvg, pickIconFiles } from "$/utils/icon_import";

  interface Props {
    onSubmit: (i: MaterialIcon) => void;
    onSubmitSvg: (i: string) => void;
    label?: string;
  }

  let { onSubmit, onSubmitSvg, label }: Props = $props();

  let iconNames = $state<MaterialIcon[]>([]);
  let search = $state<string>("");
  let deleteMode = $state<boolean>(false);
  let dropdown: HTMLDivElement;

  const onShow = () => {
    if (iconNames.length === 0) {
      iconNames = Object.keys(iconCodepoints) as MaterialIcon[];
    }
  };

  let dragOver = $state<boolean>(false);

  /** Icons are added one by one, so when storage is full the icons before it are still kept */
  const addFiles = async (files: File[]) => {
    let counter = 0;
    for (const file of files) {
      try {
        const data = await iconFileToSvg(file);
        const icon = { name: `i_${FileUtils.timestampFloat()}_${counter++}`, data };
        userIcons.update((prev) => [...prev, icon]);
      } catch (e) {
        Toasts.error(e);
        if (e instanceof DOMException && e.name === "QuotaExceededError") {
          break;
        }
      }
    }
  };

  const addOwn = async () => {
    await addFiles(await pickIconFiles());
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    dragOver = false;
    if (e.dataTransfer?.files) {
      addFiles([...e.dataTransfer.files]);
    }
  };

  const svgClicked = (name: string, data: string) => {
    if (deleteMode) {
      userIcons.update((prev) => prev.filter((e) => e.name !== name));
      return;
    }

    onSubmitSvg(data);
  };

  const iconClicked = (i: MaterialIcon) => {
    if (deleteMode) {
      return;
    }

    onSubmit(i);
  };

  onMount(() => {
    dropdown?.addEventListener("show.bs.dropdown", onShow);
  });

  onDestroy(() => {
    dropdown?.removeEventListener("show.bs.dropdown", onShow);
  });
</script>

<div class="dropdown" bind:this={dropdown}>
  <button class="btn btn-sm btn-secondary" data-bs-toggle="dropdown" data-bs-auto-close="outside">
    <MdIcon icon="emoji_emotions" />
    {#if label}<span class="tool-label">{label}</span>{:else}<MdIcon icon="add" />{/if}
  </button>

  <div
    class="dropdown-menu {dragOver ? 'drag-over' : ''}"
    role="region"
    ondragover={(e) => {
      e.preventDefault();
      dragOver = true;
    }}
    ondragleave={() => (dragOver = false)}
    ondrop={onDrop}>
    <h6 class="dropdown-header">{$tr("editor.iconpicker.title")}</h6>
    <div class="p-3">
      <div class="d-flex gap-1 mb-1">
        <button class="btn btn-primary flex-grow-1" onclick={addOwn}>
          <MdIcon icon="upload" />
          {$tr("editor.iconpicker.add")}
        </button>
        <button
          class="btn {deleteMode ? 'btn-danger' : 'btn-outline-secondary'}"
          title={$tr("editor.iconpicker.delete_mode")}
          onclick={() => (deleteMode = !deleteMode)}>
          <MdIcon icon="delete" />
        </button>
      </div>
      <div class="form-text mb-2">{$tr("editor.iconpicker.add.help")}</div>

      <input
        disabled={$appConfig.iconListMode === "user"}
        type="text"
        class="form-control mb-1"
        placeholder={$tr("editor.iconpicker.search")}
        bind:value={search} />

      <div class="input-group input-group-sm mb-1">
        <span class="input-group-text">{$tr("editor.iconpicker.show")}</span>
        <select class="form-select form-select-sm" bind:value={$appConfig.iconListMode}>
          <option value="both">{$tr("editor.iconpicker.show.both")}</option>
          <option value="user">{$tr("editor.iconpicker.show.user")}</option>
          <option value="pack">{$tr("editor.iconpicker.show.pack")}</option>
        </select>
      </div>

      <div class="icons mb-1">
        {#if $appConfig.iconListMode === "both" || $appConfig.iconListMode === "user"}
          {#each $userIcons as { name, data } (name)}
            <button
              class="btn {deleteMode ? 'btn-danger' : 'btn-light'} me-1 mb-1 user-icon"
              onclick={() => svgClicked(name, data)}>
              <img src="data:image/svg+xml;base64,{FileUtils.base64str(data)}" alt="user-svg" />
            </button>
          {/each}
        {/if}

        {#if $appConfig.iconListMode === "both" || $appConfig.iconListMode === "pack"}
          {#each iconNames as name (name)}
            {#if !search || name.includes(search.toLowerCase())}
              <button class="btn me-1" title={name} onclick={() => iconClicked(name)}>
                <MdIcon icon={name} />
              </button>
            {/if}
          {/each}
        {/if}
      </div>

      <a
        href="https://fonts.google.com/icons?icon.set=Material+Icons&icon.style=Filled"
        target="_blank"
        class="text-secondary">
        {$tr("editor.iconpicker.mdi_link_title")}
      </a>
    </div>
  </div>
</div>

<style>
  .dropdown-menu {
    width: 100vw;
    max-width: 450px;
  }
  .icons {
    max-height: 400px;
    overflow-y: scroll;
  }
  .user-icon {
    width: 56px;
    height: 56px;
    padding: 4px;
  }
  .user-icon img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .dropdown-menu.drag-over {
    outline: 2px dashed var(--bs-primary);
  }
</style>
