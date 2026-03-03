import type { PageMessage } from "./types";

console.log("[WebMCP Bridge] content-main loaded");

function postToIsolated(message: PageMessage) {
  window.postMessage(message, "*");
}

function handleMessage(event: MessageEvent<PageMessage>) {
  if (event.source !== window) return;
  const data = event.data;
  if (!data || typeof data.type !== "string") return;

  switch (data.type) {
    case "WEBMCP_EXECUTE_TOOL":
      // TODO: call navigator.modelContextTesting.executeTool()
      break;
    case "WEBMCP_REQUEST_TOOLS":
      // TODO: re-send current tool list
      break;
  }
}

window.addEventListener("message", handleMessage);

// TODO: poll for navigator.modelContextTesting, call listTools(),
// register toolsChangedCallback, post WEBMCP_TOOLS_UPDATED

void postToIsolated;
