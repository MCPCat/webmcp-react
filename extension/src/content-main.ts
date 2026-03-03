import type { PageMessage, BrowserTool } from "./types";

console.log("[WebMCP Bridge] content-main loaded");

function postToIsolated(message: PageMessage) {
  window.postMessage(message, "*");
}

function sendToolsUpdate(tools: BrowserTool[]) {
  postToIsolated({ type: "WEBMCP_TOOLS_UPDATED", tools });
}

function handleMessage(event: MessageEvent<PageMessage>) {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || typeof data.type !== "string") return;

  switch (data.type) {
    case "WEBMCP_EXECUTE_TOOL": {
      const ctx = navigator.modelContextTesting;
      if (!ctx) {
        postToIsolated({
          type: "WEBMCP_TOOL_RESULT",
          requestId: data.requestId,
          result: null,
          error: "modelContextTesting not available",
        });
        break;
      }
      ctx
        .executeTool(data.toolName, data.argsJson)
        .then((result: string | null) => {
          postToIsolated({
            type: "WEBMCP_TOOL_RESULT",
            requestId: data.requestId,
            result,
          });
        })
        .catch((err: unknown) => {
          postToIsolated({
            type: "WEBMCP_TOOL_RESULT",
            requestId: data.requestId,
            result: null,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      break;
    }
    case "WEBMCP_REQUEST_TOOLS": {
      const ctx = navigator.modelContextTesting;
      if (ctx) {
        sendToolsUpdate(ctx.listTools());
      }
      break;
    }
  }
}

window.addEventListener("message", handleMessage);

// Poll for navigator.modelContextTesting availability
const POLL_INTERVAL = 100;
const POLL_TIMEOUT = 10_000;
let elapsed = 0;

const pollTimer = setInterval(() => {
  elapsed += POLL_INTERVAL;
  const ctx = navigator.modelContextTesting;

  if (ctx) {
    clearInterval(pollTimer);
    console.log("[WebMCP Bridge] modelContextTesting found");

    // Send initial tool list
    sendToolsUpdate(ctx.listTools());

    // Listen for changes
    ctx.registerToolsChangedCallback(() => {
      sendToolsUpdate(ctx.listTools());
    });
    return;
  }

  if (elapsed >= POLL_TIMEOUT) {
    clearInterval(pollTimer);
    console.log("[WebMCP Bridge] modelContextTesting not found after 10s, giving up");
  }
}, POLL_INTERVAL);
