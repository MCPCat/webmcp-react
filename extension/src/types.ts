// ── Tool shape from modelContextTesting.listTools() ──

export interface BrowserTool {
  name: string;
  description: string;
  inputSchema?: string; // JSON-stringified JSON Schema
}

// ── Page messages (content-main ↔ content-isolated via window.postMessage) ──
//
// Trust model: the page is the trust boundary. Any script on the page can
// register tools via navigator.modelContext.registerTool() directly, so
// spoofing postMessage gives the same outcome via a different path. We do
// not attempt to authenticate messages from the MAIN world — there is no
// secure channel between MAIN and ISOLATED worlds in Chrome's architecture.

export interface PageToolsUpdatedMessage {
  type: "WEBMCP_TOOLS_UPDATED";
  tools: BrowserTool[];
}

export interface PageToolResultMessage {
  type: "WEBMCP_TOOL_RESULT";
  requestId: string;
  result: string | null;
  error?: string;
}

export interface PageExecuteToolMessage {
  type: "WEBMCP_EXECUTE_TOOL";
  requestId: string;
  toolName: string;
  argsJson: string;
}

export interface PageRequestToolsMessage {
  type: "WEBMCP_REQUEST_TOOLS";
}

export type PageMessage =
  | PageToolsUpdatedMessage
  | PageToolResultMessage
  | PageExecuteToolMessage
  | PageRequestToolsMessage;

// ── Runtime messages (content-isolated ↔ background via chrome.runtime) ──

export interface RuntimeToolsUpdatedMessage {
  type: "TOOLS_UPDATED";
  tools: BrowserTool[];
}

export interface RuntimeToolResultMessage {
  type: "TOOL_RESULT";
  requestId: string;
  result: string | null;
  error?: string;
}

export interface RuntimeExecuteToolMessage {
  type: "EXECUTE_TOOL";
  requestId: string;
  toolName: string;
  argsJson: string;
}

export interface RuntimeRequestToolsMessage {
  type: "REQUEST_TOOLS";
}

export interface RuntimeGetStatusMessage {
  type: "GET_STATUS";
}

export interface RuntimeStatusMessage {
  type: "STATUS";
  tabs: Array<{
    tabId: number;
    title: string;
    url: string;
    toolCount: number;
    toolNames: string[];
  }>;
  mcpServerConnected: boolean;
}

export type RuntimeMessage =
  | RuntimeToolsUpdatedMessage
  | RuntimeToolResultMessage
  | RuntimeExecuteToolMessage
  | RuntimeRequestToolsMessage
  | RuntimeGetStatusMessage
  | RuntimeStatusMessage;

// ── WebSocket messages (background ↔ MCP server) ──

export interface WsListToolsRequest {
  type: "LIST_TOOLS";
  requestId: string;
}

export interface WsToolsListResponse {
  type: "TOOLS_LIST";
  requestId: string;
  tools: Array<{
    name: string; // namespaced: "tab-{id}:{name}"
    description: string;
    inputSchema?: object; // parsed JSON Schema
    tabId: number;
    tabTitle: string;
    tabUrl: string;
  }>;
}

export interface WsCallToolRequest {
  type: "CALL_TOOL";
  requestId: string;
  tabId: number;
  toolName: string;
  argsJson: string;
}

export interface WsToolResultResponse {
  type: "TOOL_RESULT";
  requestId: string;
  result: string | null;
  error?: string;
}

export interface WsToolsChangedNotification {
  type: "TOOLS_CHANGED";
}

export type WsMessageFromServer =
  | WsListToolsRequest
  | WsCallToolRequest;

export type WsMessageFromExtension =
  | WsToolsListResponse
  | WsToolResultResponse
  | WsToolsChangedNotification;

// ── Aggregated tool (used by both background and MCP server) ──

export interface AggregatedTool {
  namespacedName: string; // "tab-123:filter_products"
  originalName: string;
  description: string;
  inputSchema?: object; // parsed JSON Schema
  tabId: number;
  tabTitle: string;
  tabUrl: string;
}
