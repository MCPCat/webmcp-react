import type {
  BrowserTool,
  RuntimeMessage,
  WsMessageFromServer,
  WsToolsListResponse,
  WsToolResultResponse,
  WsToolsChangedNotification,
} from "./types";

console.log("[WebMCP Bridge] background loaded");

const tabTools = new Map<
  number,
  { tools: BrowserTool[]; title: string; url: string }
>();

const pendingCalls = new Map<string, number>();

let ws: WebSocket | null = null;
let wsConnected = false;
let reconnectDelay = 1000;
const MAX_RECONNECT_DELAY = 30_000;
const WS_PORT = 12315;

function sanitize(str: string, maxLen: number): string {
  return str.length > maxLen ? str.slice(0, maxLen) : str;
}

function hostnameFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

function parseInputSchema(schema?: string): object | undefined {
  if (!schema) return undefined;
  try {
    return JSON.parse(schema) as object;
  } catch {
    return undefined;
  }
}

function buildAggregatedTools(): WsToolsListResponse["tools"] {
  const tools: WsToolsListResponse["tools"] = [];
  for (const [tabId, info] of tabTools) {
    const title = sanitize(info.title, 500);
    const url = sanitize(info.url, 500);
    for (const tool of info.tools) {
      tools.push({
        name: `tab-${tabId}:${tool.name}`,
        description: `[${title}: ${hostnameFromUrl(url)}] ${tool.description}`,
        inputSchema: parseInputSchema(tool.inputSchema),
        tabId,
        tabTitle: title,
        tabUrl: url,
      });
    }
  }
  return tools;
}

function wsSend(data: WsToolsListResponse | WsToolResultResponse | WsToolsChangedNotification) {
  if (ws && wsConnected) {
    ws.send(JSON.stringify(data));
  }
}

function notifyToolsChanged() {
  wsSend({ type: "TOOLS_CHANGED" });
}

function rejectPendingCallsForTab(tabId: number) {
  for (const [requestId, callTabId] of pendingCalls) {
    if (callTabId === tabId) {
      pendingCalls.delete(requestId);
      wsSend({
        type: "TOOL_RESULT",
        requestId,
        result: null,
        error: "Tab closed or navigated away",
      });
    }
  }
}

function connectWebSocket() {
  try {
    ws = new WebSocket(`ws://127.0.0.1:${WS_PORT}`);
  } catch {
    scheduleReconnect();
    return;
  }

  ws.onopen = () => {
    console.log("[WebMCP Bridge] Connected to MCP server");
    wsConnected = true;
    reconnectDelay = 1000;

    // Force fresh tool sync on reconnect
    notifyToolsChanged();
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(String(event.data)) as WsMessageFromServer;
      handleServerMessage(data);
    } catch {
      console.error("[WebMCP Bridge] Failed to parse server message");
    }
  };

  ws.onclose = () => {
    console.log("[WebMCP Bridge] Disconnected from MCP server");
    wsConnected = false;
    ws = null;
    scheduleReconnect();
  };

  ws.onerror = () => {
    // onclose will fire after this. reconnect handled there
  };
}

function scheduleReconnect() {
  setTimeout(() => {
    connectWebSocket();
  }, reconnectDelay);
  reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY);
}

function handleServerMessage(data: WsMessageFromServer) {
  switch (data.type) {
    case "LIST_TOOLS": {
      const tools = buildAggregatedTools();
      wsSend({
        type: "TOOLS_LIST",
        requestId: data.requestId,
        tools,
      });
      break;
    }
    case "CALL_TOOL": {
      const { requestId, tabId, toolName, argsJson } = data;

      if (!tabTools.has(tabId)) {
        wsSend({
          type: "TOOL_RESULT",
          requestId,
          result: null,
          error: `Tab ${tabId} not found`,
        });
        break;
      }

      pendingCalls.set(requestId, tabId);

      chrome.tabs.sendMessage(tabId, {
        type: "EXECUTE_TOOL",
        requestId,
        toolName,
        argsJson,
      } satisfies RuntimeMessage);
      break;
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message: RuntimeMessage, sender, sendResponse) => {
    switch (message.type) {
      case "TOOLS_UPDATED": {
        const tabId = sender.tab?.id;
        if (tabId == null) break;
        tabTools.set(tabId, {
          tools: message.tools,
          title: sanitize(sender.tab?.title ?? "", 500),
          url: sanitize(sender.tab?.url ?? "", 500),
        });
        notifyToolsChanged();
        break;
      }
      case "TOOL_RESULT": {
        const { requestId, result, error } = message;
        // Only forward if we have a pending call for this requestId
        if (!pendingCalls.has(requestId)) break;
        pendingCalls.delete(requestId);

        wsSend({
          type: "TOOL_RESULT",
          requestId,
          result,
          error,
        });
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
          mcpServerConnected: wsConnected,
        } satisfies RuntimeMessage);
        return true; // async response
      }
    }
  },
);

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabTools.has(tabId)) {
    tabTools.delete(tabId);
    rejectPendingCallsForTab(tabId);
    notifyToolsChanged();
  }
});

// Clean up when tabs navigate
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading" && tabTools.has(tabId)) {
    tabTools.delete(tabId);
    rejectPendingCallsForTab(tabId);
    notifyToolsChanged();
  }
});

// Start WebSocket connection
connectWebSocket();
