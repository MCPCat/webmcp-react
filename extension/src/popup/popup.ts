import type {
  RuntimeActivateDomainMessage,
  RuntimeActivateTabMessage,
  RuntimeDeactivateDomainMessage,
  RuntimeDeactivateTabMessage,
  RuntimeGetStatusMessage,
  RuntimeStatusMessage,
} from "../types";

const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const toolsEl = document.getElementById("tools");
const domainLabel = document.getElementById("domain-label");
const radios = document.querySelectorAll<HTMLInputElement>(
  'input[name="mode"]',
);

let currentTabId: number | undefined;
let currentOrigin: string | undefined;
let currentMode: "off" | "tab" | "domain" = "off";
let pollTimer: ReturnType<typeof setInterval> | null = null;

function setStatus(color: "green" | "yellow" | "grey", text: string) {
  if (statusDot) {
    statusDot.className = color;
  }
  if (statusText) {
    statusText.textContent = text;
  }
}

async function init() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id || !tab.url) {
    setStatus("grey", "No active tab");
    return;
  }

  currentTabId = tab.id;
  try {
    currentOrigin = new URL(tab.url).origin;
  } catch {
    setStatus("grey", "Invalid tab URL");
    return;
  }

  if (domainLabel) {
    domainLabel.textContent = new URL(tab.url).hostname;
  }

  // Disable radios for non-http pages (chrome://, about:, etc.)
  if (!tab.url.startsWith("http")) {
    for (const radio of radios) {
      if (radio.value !== "off") radio.disabled = true;
    }
    setStatus("grey", "Not available on this page");
    return;
  }

  refreshStatus();
}

function refreshStatus() {
  if (!currentTabId) return;
  chrome.runtime.sendMessage(
    { type: "GET_STATUS", tabId: currentTabId } satisfies RuntimeGetStatusMessage,
    (response: RuntimeStatusMessage) => {
      if (!response) {
        setStatus("grey", "No response from background");
        return;
      }

      currentMode = response.currentTabActivation;
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="mode"][value="${currentMode}"]`,
      );
      if (radio) radio.checked = true;

      updateStatusDisplay(currentMode, response.mcpServerConnected, response.tabs);
      renderTools(response, currentTabId!);
    },
  );
}

function startPollingForTools() {
  if (pollTimer) clearInterval(pollTimer);
  let attempts = 0;
  pollTimer = setInterval(() => {
    attempts++;
    if (attempts > 20) {
      // 10 seconds, give up
      clearInterval(pollTimer!);
      pollTimer = null;
      return;
    }
    refreshStatus();
  }, 500);
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function updateStatusDisplay(
  mode: "off" | "tab" | "domain",
  mcpConnected: boolean,
  tabs: RuntimeStatusMessage["tabs"],
) {
  if (mode === "off") {
    setStatus("grey", "Disabled on this page");
    return;
  }
  if (!mcpConnected) {
    setStatus("yellow", "Not connected to any MCP client");
    return;
  }
  const totalTools = tabs.reduce((sum, t) => sum + t.toolCount, 0);
  if (totalTools === 0) {
    setStatus("green", "Connected \u00b7 no tools registered");
  } else {
    const tabCount = tabs.length;
    setStatus(
      "green",
      `Connected \u00b7 ${totalTools} tool${totalTools !== 1 ? "s" : ""} across ${tabCount} tab${tabCount !== 1 ? "s" : ""}`,
    );
  }
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function renderTools(status: RuntimeStatusMessage, tabId: number) {
  if (!toolsEl) return;
  toolsEl.replaceChildren();

  if (currentMode === "off") return;

  const allTabs = status.tabs;
  const totalTools = allTabs.reduce((sum, t) => sum + t.toolCount, 0);

  if (totalTools === 0) {
    const msg = document.createElement("div");
    msg.className = "tools-empty";
    msg.textContent = "Waiting for tools...";
    toolsEl.appendChild(msg);
    return;
  }

  // Tools appeared, stop polling
  stopPolling();

  // Current tab first, then others
  const currentTab = allTabs.find((t) => t.tabId === tabId);
  const otherTabs = allTabs.filter((t) => t.tabId !== tabId && t.toolCount > 0);

  const renderGroup = (
    label: string,
    toolNames: string[],
  ) => {
    const header = document.createElement("div");
    header.className = "tab-group-header";
    header.textContent = label;
    toolsEl.appendChild(header);

    for (const name of toolNames) {
      const item = document.createElement("div");
      item.className = "tool-item";
      item.textContent = name;
      toolsEl.appendChild(item);
    }
  };

  if (currentTab && currentTab.toolCount > 0) {
    renderGroup("Current tab", currentTab.toolNames);
  }

  for (const tab of otherTabs) {
    const label = `${tab.title} (${hostnameFromUrl(tab.url)})`;
    renderGroup(label, tab.toolNames);
  }
}

async function handleModeChange(newMode: string) {
  if (!currentTabId || !currentOrigin) return;
  const previousMode = currentMode;

  try {
    if (newMode === "tab") {
      await chrome.runtime.sendMessage({
        type: "ACTIVATE_TAB",
        tabId: currentTabId,
      } satisfies RuntimeActivateTabMessage);
      // Unregister persistent scripts — tab is already authorized so tools won't be purged
      if (previousMode === "domain") {
        await chrome.runtime.sendMessage({
          type: "DEACTIVATE_DOMAIN",
          origin: currentOrigin,
        } satisfies RuntimeDeactivateDomainMessage);
      }
      currentMode = "tab";
      startPollingForTools();
    } else if (newMode === "domain") {
      const granted = await chrome.permissions.request({
        origins: [`${currentOrigin}/*`],
      });
      if (!granted) {
        const radio = document.querySelector<HTMLInputElement>(
          `input[name="mode"][value="${previousMode}"]`,
        );
        if (radio) radio.checked = true;
        return;
      }
      await chrome.runtime.sendMessage({
        type: "ACTIVATE_DOMAIN",
        tabId: currentTabId,
        origin: currentOrigin,
      } satisfies RuntimeActivateDomainMessage);
      currentMode = "domain";
      startPollingForTools();
    } else {
      // "off" — deactivate everything
      if (previousMode === "domain") {
        await chrome.runtime.sendMessage({
          type: "DEACTIVATE_DOMAIN",
          origin: currentOrigin,
        } satisfies RuntimeDeactivateDomainMessage);
      }
      // Always deactivate tab — both modes add to activatedTabs
      await chrome.runtime.sendMessage({
        type: "DEACTIVATE_TAB",
        tabId: currentTabId,
      } satisfies RuntimeDeactivateTabMessage);
      currentMode = "off";
      stopPolling();
      refreshStatus();
    }
  } catch (err) {
    console.error("[WebMCP Bridge] activation error:", err);
    // Revert on error
    const radio = document.querySelector<HTMLInputElement>(
      `input[name="mode"][value="${previousMode}"]`,
    );
    if (radio) radio.checked = true;
  }
}

for (const radio of radios) {
  radio.addEventListener("change", (e) => {
    const target = e.target as HTMLInputElement;
    if (target.checked) {
      handleModeChange(target.value);
    }
  });
}

init();
