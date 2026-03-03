interface ModelContextTesting {
  listTools(): BrowserTool[];
  executeTool(
    toolName: string,
    inputArgsJson: string,
  ): Promise<string | null>;
  registerToolsChangedCallback(callback: () => void): void;
}

declare global {
  interface Navigator {
    modelContextTesting?: ModelContextTesting;
  }
}

export interface BrowserTool {
  name: string;
  description: string;
  inputSchema?: string; // JSON-stringified JSON Schema
}

// No auth on page messages — MAIN world has the same privileges as registerTool().

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

export interface AggregatedTool {
  namespacedName: string; // "tab-123:filter_products"
  originalName: string;
  description: string;
  inputSchema?: object; // parsed JSON Schema
  tabId: number;
  tabTitle: string;
  tabUrl: string;
}
