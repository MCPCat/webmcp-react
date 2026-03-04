import type {
  RuntimeActivateDomainMessage,
  RuntimeActivateTabMessage,
  RuntimeDeactivateDomainMessage,
  RuntimeGetStatusMessage,
  RuntimeStatusMessage,
} from "../types";

const statusEl = document.getElementById("status");
const toolsEl = document.getElementById("tools");
const domainLabel = document.getElementById("domain-label");
const radios = document.querySelectorAll<HTMLInputElement>(
  'input[name="mode"]',
);

let currentTabId: number | undefined;
let currentOrigin: string | undefined;
let currentMode: "off" | "tab" | "domain" = "off";

async function init() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  if (!tab?.id || !tab.url) {
    if (statusEl) statusEl.textContent = "No active tab";
    return;
  }

  currentTabId = tab.id;
  try {
    currentOrigin = new URL(tab.url).origin;
  } catch {
    if (statusEl) statusEl.textContent = "Invalid tab URL";
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
    if (statusEl) statusEl.textContent = "Not available on this page";
    return;
  }

  chrome.runtime.sendMessage(
    { type: "GET_STATUS", tabId: currentTabId } satisfies RuntimeGetStatusMessage,
    (response: RuntimeStatusMessage) => {
      if (!response) {
        if (statusEl) statusEl.textContent = "No response from background";
        return;
      }

      currentMode = response.currentTabActivation;
      const radio = document.querySelector<HTMLInputElement>(
        `input[name="mode"][value="${currentMode}"]`,
      );
      if (radio) radio.checked = true;

      if (statusEl) {
        statusEl.textContent = response.mcpServerConnected
          ? "MCP server connected"
          : "MCP server disconnected";
      }

      renderTools(response, currentTabId!);
    },
  );
}

function renderTools(status: RuntimeStatusMessage, tabId: number) {
  if (!toolsEl) return;
  toolsEl.replaceChildren();

  const tabInfo = status.tabs.find((t) => t.tabId === tabId);
  if (!tabInfo || tabInfo.toolCount === 0) return;

  for (const name of tabInfo.toolNames) {
    const div = document.createElement("div");
    div.className = "tab";
    const strong = document.createElement("strong");
    strong.textContent = name;
    div.appendChild(strong);
    toolsEl.appendChild(div);
  }
}

async function handleModeChange(newMode: string) {
  if (!currentTabId || !currentOrigin) return;
  const previousMode = currentMode;

  try {
    // Deactivate domain if switching away from it
    if (previousMode === "domain" && newMode !== "domain") {
      await chrome.runtime.sendMessage({
        type: "DEACTIVATE_DOMAIN",
        origin: currentOrigin,
      } satisfies RuntimeDeactivateDomainMessage);
    }

    if (newMode === "tab") {
      await chrome.runtime.sendMessage({
        type: "ACTIVATE_TAB",
        tabId: currentTabId,
      } satisfies RuntimeActivateTabMessage);
      currentMode = "tab";
    } else if (newMode === "domain") {
      // Must request permission from popup (user gesture context)
      const granted = await chrome.permissions.request({
        origins: [`${currentOrigin}/*`],
      });
      if (!granted) {
        // Revert radio selection
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
    } else {
      // "off" — nothing extra to do (domain deactivation handled above)
      currentMode = "off";
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
