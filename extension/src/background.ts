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

// Activation state
const activatedTabs = new Set<number>();
const activatedDomains = new Set<string>();

let ws: WebSocket | null = null;
let wsConnected = false;
let reconnectDelay = 1000;
let keepAliveInterval: ReturnType<typeof setInterval> | null = null;
const MAX_RECONNECT_DELAY = 30_000;
const WS_PORT = 12315;
const STORAGE_KEY = "activatedDomains";

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

function originFromUrl(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
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

// Simple hash for use in content script registration IDs
function originHash(origin: string): string {
  let hash = 0;
  for (let i = 0; i < origin.length; i++) {
    hash = ((hash << 5) - hash + origin.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
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

// --- Activation helpers ---

async function persistDomains() {
  await chrome.storage.local.set({
    [STORAGE_KEY]: Array.from(activatedDomains),
  });
}

async function loadPersistedDomains() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  const domains: string[] = data[STORAGE_KEY] ?? [];
  for (const d of domains) {
    activatedDomains.add(d);
  }
  if (domains.length > 0) {
    await registerContentScriptsForDomains(domains);
  }
}

async function registerContentScriptsForDomains(origins: string[]) {
  const scripts: chrome.scripting.RegisteredContentScript[] = [];
  for (const origin of origins) {
    const h = originHash(origin);
    scripts.push(
      {
        id: `webmcp-main-${h}`,
        matches: [`${origin}/*`],
        js: ["content-main.js"],
        world: "MAIN" as chrome.scripting.ExecutionWorld,
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
      {
        id: `webmcp-isolated-${h}`,
        matches: [`${origin}/*`],
        js: ["content-isolated.js"],
        runAt: "document_idle",
        persistAcrossSessions: true,
      },
    );
  }
  try {
    await chrome.scripting.registerContentScripts(scripts);
  } catch (err) {
    // Scripts may already be registered from a previous session
    console.warn("[WebMCP Bridge] registerContentScripts:", err);
  }
}

async function unregisterContentScriptsForDomain(origin: string) {
  const h = originHash(origin);
  try {
    await chrome.scripting.unregisterContentScripts({
      ids: [`webmcp-main-${h}`, `webmcp-isolated-${h}`],
    });
  } catch {
    // Already unregistered
  }
}

async function injectContentScripts(tabId: number) {
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-isolated.js"],
  });
  await chrome.scripting.executeScript({
    target: { tabId },
    files: ["content-main.js"],
    world: "MAIN" as chrome.scripting.ExecutionWorld,
  });
}

function purgeTabTools(tabId: number) {
  if (tabTools.has(tabId)) {
    tabTools.delete(tabId);
    rejectPendingCallsForTab(tabId);
    notifyToolsChanged();
  }
}

function getTabActivation(tabId: number, tabUrl?: string): "off" | "tab" | "domain" {
  if (tabUrl) {
    const origin = originFromUrl(tabUrl);
    if (origin && activatedDomains.has(origin)) return "domain";
  }
  if (activatedTabs.has(tabId)) return "tab";
  return "off";
}

// --- WebSocket ---

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

    keepAliveInterval = setInterval(() => {
      if (ws && wsConnected) {
        ws.send(JSON.stringify({ type: "PING" }));
      }
    }, 20_000);

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
    if (keepAliveInterval) {
      clearInterval(keepAliveInterval);
      keepAliveInterval = null;
    }
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

      chrome.tabs.sendMessage(
        tabId,
        {
          type: "EXECUTE_TOOL",
          requestId,
          toolName,
          argsJson,
        } satisfies RuntimeMessage,
        () => {
          if (chrome.runtime.lastError) {
            pendingCalls.delete(requestId);
            wsSend({
              type: "TOOL_RESULT",
              requestId,
              result: null,
              error: `Failed to reach tab ${tabId}: ${chrome.runtime.lastError.message}`,
            });
          }
        },
      );
      break;
    }
  }
}

// --- Runtime message handler ---

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
      case "ACTIVATE_TAB": {
        const { tabId } = message;
        if (activatedTabs.has(tabId)) {
          sendResponse({ ok: true });
          return true;
        }
        activatedTabs.add(tabId);
        injectContentScripts(tabId).then(
          () => sendResponse({ ok: true }),
          (err) => sendResponse({ ok: false, error: String(err) }),
        );
        return true; // async response
      }
      case "ACTIVATE_DOMAIN": {
        const { tabId, origin } = message;
        activatedDomains.add(origin);
        Promise.all([
          persistDomains(),
          registerContentScriptsForDomains([origin]),
          // Also inject into current tab immediately
          activatedTabs.has(tabId)
            ? Promise.resolve()
            : injectContentScripts(tabId),
        ]).then(
          () => {
            activatedTabs.add(tabId);
            sendResponse({ ok: true });
          },
          (err) => sendResponse({ ok: false, error: String(err) }),
        );
        return true;
      }
      case "DEACTIVATE_DOMAIN": {
        const { origin } = message;
        activatedDomains.delete(origin);

        // Purge tools from tabs on this origin
        for (const [tabId, info] of tabTools) {
          if (originFromUrl(info.url) === origin) {
            purgeTabTools(tabId);
          }
        }
        // Also remove session activations for tabs on this origin
        for (const tabId of activatedTabs) {
          const info = tabTools.get(tabId);
          if (info && originFromUrl(info.url) === origin) {
            activatedTabs.delete(tabId);
          }
        }

        Promise.all([
          persistDomains(),
          unregisterContentScriptsForDomain(origin),
          chrome.permissions.remove({ origins: [`${origin}/*`] }),
        ]).then(
          () => sendResponse({ ok: true }),
          (err) => sendResponse({ ok: false, error: String(err) }),
        );
        return true;
      }
      case "GET_STATUS": {
        const queryTabId = message.tabId;
        // Look up the tab URL for activation status
        const getActivation = async (): Promise<"off" | "tab" | "domain"> => {
          if (queryTabId == null) return "off";
          try {
            const tab = await chrome.tabs.get(queryTabId);
            return getTabActivation(queryTabId, tab.url);
          } catch {
            return "off";
          }
        };

        getActivation().then((currentTabActivation) => {
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
            activatedTabs: Array.from(activatedTabs),
            activatedDomains: Array.from(activatedDomains),
            currentTabActivation,
          } satisfies RuntimeMessage);
        });
        return true;
      }
    }
  },
);

// Clean up when tabs close
chrome.tabs.onRemoved.addListener((tabId) => {
  activatedTabs.delete(tabId);
  if (tabTools.has(tabId)) {
    tabTools.delete(tabId);
    rejectPendingCallsForTab(tabId);
    notifyToolsChanged();
  }
});

// Clean up when tabs navigate
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === "loading") {
    // Session-only activation doesn't survive navigation
    activatedTabs.delete(tabId);
    if (tabTools.has(tabId)) {
      tabTools.delete(tabId);
      rejectPendingCallsForTab(tabId);
      notifyToolsChanged();
    }
  }
});

// Load persisted domains and start WebSocket
loadPersistedDomains();
connectWebSocket();
