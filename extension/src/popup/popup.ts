import type { RuntimeGetStatusMessage, RuntimeStatusMessage } from "../types";

console.log("[WebMCP Bridge] popup loaded");

const statusEl = document.getElementById("status");
const tabsEl = document.getElementById("tabs");

chrome.runtime.sendMessage(
  { type: "GET_STATUS" } satisfies RuntimeGetStatusMessage,
  (response: RuntimeStatusMessage) => {
    if (!response) {
      if (statusEl) statusEl.textContent = "No response from background";
      return;
    }

    if (statusEl) {
      const toolCount = response.tabs.reduce((sum, t) => sum + t.toolCount, 0);
      statusEl.textContent = `${response.tabs.length} tab(s), ${toolCount} tool(s)`;
    }

    if (tabsEl) {
      tabsEl.replaceChildren();
      for (const tab of response.tabs) {
        const div = document.createElement("div");
        div.className = "tab";

        const strong = document.createElement("strong");
        strong.textContent = tab.title || "Untitled";
        div.appendChild(strong);

        const url = document.createElement("span");
        url.className = "url";
        url.textContent = tab.url;
        div.appendChild(url);

        const tools = document.createElement("span");
        tools.className = "tools";
        tools.textContent = tab.toolNames.join(", ") || "no tools";
        div.appendChild(tools);

        tabsEl.appendChild(div);
      }
    }
  },
);
