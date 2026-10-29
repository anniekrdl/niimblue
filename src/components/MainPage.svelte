<script lang="ts">
  import BrowserWarning from "$/components/basic/BrowserWarning.svelte";
  import LabelDesigner from "$/components/LabelDesigner.svelte";
  import PrinterConnector from "$/components/PrinterConnector.svelte";
  import { locale, locales, tr } from "$/utils/i18n";
  import DebugStuff from "$/components/DebugStuff.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";
  import { accentColor } from "$/stores";
  import { ACCENT_COLORS, applyAccentColor } from "$/utils/accent_colors";

  // eslint-disable-next-line no-undef
  const appCommit = __APP_COMMIT__;
  // eslint-disable-next-line no-undef
  const appVersion = __APP_VERSION__;
  // eslint-disable-next-line no-undef
  const buildDate = __BUILD_DATE__;

  let debugStuffShow = $state<boolean>(false);

  $effect(() => applyAccentColor($accentColor));
</script>

<div class="app-shell">
  <header class="app-header">
    <div class="logo"><MdIcon icon="sell" /></div>
    <h1 class="title">NiimBlue</h1>

    <div class="header-tools">
      <PrinterConnector />

      <div class="dropdown">
        <button class="btn round-btn" data-bs-toggle="dropdown" data-bs-auto-close="outside" title={$tr("ui.app_menu")}>
          <MdIcon icon="more_vert" />
        </button>
        <div class="dropdown-menu dropdown-menu-end app-menu p-3">
          <label class="form-label text-secondary" for="app-locale">{$tr("ui.language")}</label>
          <select id="app-locale" class="form-select mb-3" bind:value={$locale}>
            {#each Object.entries(locales) as [key, name] (key)}
              <option value={key}>{name}</option>
            {/each}
          </select>

          <div class="form-label text-secondary">{$tr("ui.accent")}</div>
          {#each ["bright", "soft"] as group (group)}
            <div class="accent-group text-secondary">{$tr(group === "soft" ? "ui.accent.soft" : "ui.accent.bright")}</div>
            <div class="accent-swatches mb-3">
              {#each Object.entries(ACCENT_COLORS).filter(([, c]) => c.group === group) as [key, color] (key)}
                <button
                  class="swatch {$accentColor === key ? 'selected' : ''}"
                  style:background={color.main}
                  title={$tr(color.name)}
                  aria-label={$tr(color.name)}
                  onclick={() => accentColor.set(key)}>
                  {#if $accentColor === key}<MdIcon icon="check" />{/if}
                </button>
              {/each}
            </div>
          {/each}

          <div class="text-secondary small">
            {#if appVersion}
              <a class="text-secondary" href="https://github.com/MultiMote/niimblue/releases/tag/{appVersion}">
                {appVersion}
              </a>
            {:else if appCommit}
              <a class="text-secondary" href="https://github.com/MultiMote/niimblue/commit/{appCommit}">
                {appCommit.slice(0, 6)}
              </a>
            {/if}
            {$tr("main.built")}
            {buildDate}
          </div>

          <div class="d-flex justify-content-between align-items-center mt-2">
            <a class="text-secondary" href="https://github.com/MultiMote/niimblue">{$tr("main.code")}</a>
            <button class="text-secondary btn btn-link p-0" onclick={() => (debugStuffShow = true)}>
              <MdIcon icon="bug_report" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <BrowserWarning />

  <main class="app-main">
    <LabelDesigner />
  </main>
</div>

{#if debugStuffShow}
  <DebugStuff bind:show={debugStuffShow} />
{/if}

<style>
  .app-shell {
    display: flex;
    flex-direction: column;
    height: 100dvh;
    max-width: 1100px;
    margin: 0 auto;
    padding: calc(10px + env(safe-area-inset-top)) 8px calc(6px + env(safe-area-inset-bottom));
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 4px 10px;
  }

  .logo {
    display: flex;
    flex: none;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: var(--np-accent);
    color: var(--np-ink);
    font-size: 1.5rem;
  }

  .title {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin: 0;
    font-size: 1.45rem;
    font-weight: 700;
    color: #fff;
  }

  .header-tools {
    flex: none;
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .round-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 0;
    border-radius: 50%;
    background: var(--np-card);
    color: #fff;
    font-size: 1.3rem;
  }

  .app-menu {
    width: 260px;
  }

  @media (max-width: 767.98px) {
    .title {
      font-size: 1.25rem;
    }
  }

  .accent-group {
    margin-bottom: 6px;
    font-size: 0.85rem;
  }

  .accent-swatches {
    display: grid;
    grid-template-columns: repeat(auto-fill, 44px);
    gap: 12px;
  }

  .swatch {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    padding: 0;
    border: 3px solid transparent;
    border-radius: 50%;
    color: var(--np-ink);
    font-size: 1.3rem;
  }

  .swatch.selected {
    border-color: #fff;
  }

  .app-main {
    flex: 1 1 auto;
    min-height: 0;
  }
</style>
