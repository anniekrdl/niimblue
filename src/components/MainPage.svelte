<script lang="ts">
  import { Utils } from "@mmote/niimbluelib";
  import BrowserWarning from "$/components/basic/BrowserWarning.svelte";
  import LabelDesigner from "$/components/LabelDesigner.svelte";
  import PrinterConnector from "$/components/PrinterConnector.svelte";
  import { locale, locales, tr } from "$/utils/i18n";
  import DebugStuff from "$/components/DebugStuff.svelte";
  import MdIcon from "$/components/basic/MdIcon.svelte";

  // eslint-disable-next-line no-undef
  const appCommit = __APP_COMMIT__;
  // eslint-disable-next-line no-undef
  const appVersion = __APP_VERSION__;
  // eslint-disable-next-line no-undef
  const buildDate = __BUILD_DATE__;

  let isStandalone = Utils.getAvailableTransports().capacitorBle || "__TAURI__" in window;

  let debugStuffShow = $state<boolean>(false);
</script>

<div class="app-shell">
  <header class="app-header">
    <h1 class="title">
      <span class="niim">Niim</span><span class="blue">Blue{isStandalone ? "s" : ""}</span>
    </h1>

    <div class="header-tools">
      <PrinterConnector />

      <div class="dropdown">
        <button class="btn btn-sm btn-secondary" data-bs-toggle="dropdown" data-bs-auto-close="outside" title={$tr("ui.app_menu")}>
          <MdIcon icon="more_vert" />
        </button>
        <div class="dropdown-menu dropdown-menu-end app-menu p-3">
          <label class="form-label text-secondary" for="app-locale">{$tr("ui.language")}</label>
          <select id="app-locale" class="form-select mb-3" bind:value={$locale}>
            {#each Object.entries(locales) as [key, name] (key)}
              <option value={key}>{name}</option>
            {/each}
          </select>

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
    padding: calc(6px + env(safe-area-inset-top)) 8px calc(6px + env(safe-area-inset-bottom));
  }

  .app-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 6px;
  }

  .title {
    font-size: 1.5rem;
    margin: 0;
    font-weight: 700;
  }

  .header-tools {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }

  .app-menu {
    width: 260px;
  }

  .app-main {
    flex: 1 1 auto;
    min-height: 0;
  }

  .niim {
    color: #ff5349;
  }

  .blue {
    color: #0b7eff;
  }
</style>
