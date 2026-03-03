import type { BrowserTool, RuntimeMessage } from "./types";

console.log("[WebMCP Bridge] background loaded");

// Aggregated tool registry: tabId -> tab info + tools
const tabTools = new Map<
  number,
  { tools: BrowserTool[]; title: string; url: string }
>();

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    switch (message.type) {
      case "TOOLS_UPDATED": {
        const tabId = sender.tab?.id;
        if (tabId == null) break;
        tabTools.set(tabId, {
          tools: message.tools,
          title: sender.tab?.title ?? "",
          url: sender.tab?.url ?? "",
        });
        // TODO: notify MCP server via WebSocket
        break;
      }
      case "TOOL_RESULT": {
        // TODO: resolve pending call
        break;
      }
      case "GET_STATUS": {
        const tabs = Array.from(tabTools.entries()).map(([tabId, info]) => ({
          tabId,
          title: info.title,
          url: info.url,
          toolCount: info.tools.length,
          toolNames: info.tools.map((t) => t.name),
        }));
        sendResponse({
          type: "STATUS",
          tabs,
          mcpServerConnected: false, // TODO: track WebSocket state
        } satisfies RuntimeMessage);
        return true; // async response
      }
    }
  },
);

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  tabTools.delete(tabId);
  // TODO: notify MCP server
});

// Clean up when tabs navigate
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    tabTools.delete(tabId);
    // TODO: notify MCP server
  }
});

// TODO: WebSocket connection to MCP server
