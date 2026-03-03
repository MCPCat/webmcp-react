import type {
  AggregatedTool,
  WsCallToolRequest,
  WsMessageFromExtension,
} from "../types";
import type { WebSocket } from "ws";

const CALL_TIMEOUT = 30_000;
const NAMESPACED_RE = /^tab-(\d+):(.+)$/;

interface PendingCall {
  resolve: (value: { content: Array<{ type: string; text: string }> }) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class ToolRegistry {
  private tools = new Map<string, AggregatedTool>();
  private changeCallbacks: Array<() => void> = [];
  private pendingCalls = new Map<string, PendingCall>();
  private ws: WebSocket | null = null;

  setWebSocket(ws: WebSocket | null) {
    this.ws = ws;
  }

  updateTools(tools: AggregatedTool[]) {
    this.tools.clear();
    for (const tool of tools) {
      this.tools.set(tool.namespacedName, tool);
    }
    this.fireChangeCallbacks();
  }

  listMcpTools(): Array<{
    name: string;
    description: string;
    inputSchema: object;
  }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.namespacedName,
      description: `[${t.tabTitle}] ${t.description}`,
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    }));
  }

  async callTool(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    const match = NAMESPACED_RE.exec(name);
    if (!match) {
      return {
        content: [
          {
            type: "text",
            text: `Invalid tool name format: "${name}". Expected "tab-{id}:{name}".`,
          },
        ],
      };
    }

    const tabId = Number(match[1]);
    const toolName = match[2];

    if (!this.tools.has(name)) {
      return {
        content: [
          { type: "text", text: `Tool "${name}" not found.` },
        ],
      };
    }

    if (!this.ws || this.ws.readyState !== this.ws.OPEN) {
      return {
        content: [
          { type: "text", text: "Extension not connected." },
        ],
      };
    }

    const requestId = crypto.randomUUID();
    const ws = this.ws;

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pendingCalls.delete(requestId);
        reject(new Error(`Tool call "${name}" timed out after ${CALL_TIMEOUT}ms`));
      }, CALL_TIMEOUT);

      this.pendingCalls.set(requestId, { resolve, reject, timer });

      const message: WsCallToolRequest = {
        type: "CALL_TOOL",
        requestId,
        tabId,
        toolName,
        argsJson: JSON.stringify(args),
      };

      ws.send(JSON.stringify(message));
    });
  }

  handleMessage(data: WsMessageFromExtension) {
    switch (data.type) {
      case "TOOLS_LIST": {
        const tools: AggregatedTool[] = data.tools.map((t) => ({
          namespacedName: t.name,
          originalName: t.name.replace(/^tab-\d+:/, ""),
          description: t.description,
          inputSchema: t.inputSchema,
          tabId: t.tabId,
          tabTitle: t.tabTitle,
          tabUrl: t.tabUrl,
        }));
        this.updateTools(tools);
        break;
      }
      case "TOOL_RESULT": {
        const pending = this.pendingCalls.get(data.requestId);
        if (!pending) break;

        clearTimeout(pending.timer);
        this.pendingCalls.delete(data.requestId);

        if (data.error) {
          pending.resolve({
            content: [{ type: "text", text: data.error }],
          });
        } else {
          pending.resolve({
            content: [{ type: "text", text: data.result ?? "" }],
          });
        }
        break;
      }
      case "TOOLS_CHANGED": {
        if (this.ws && this.ws.readyState === this.ws.OPEN) {
          const msg: { type: "LIST_TOOLS"; requestId: string } = {
            type: "LIST_TOOLS",
            requestId: crypto.randomUUID(),
          };
          this.ws.send(JSON.stringify(msg));
        }
        break;
      }
    }
  }

  clearConnection() {
    for (const [requestId, pending] of this.pendingCalls) {
      clearTimeout(pending.timer);
      pending.reject(
        new Error("Extension disconnected. Tool call aborted."),
      );
      this.pendingCalls.delete(requestId);
    }

    this.tools.clear();
    this.fireChangeCallbacks();
  }

  onToolsChanged(cb: () => void) {
    this.changeCallbacks.push(cb);
  }

  private fireChangeCallbacks() {
    for (const cb of this.changeCallbacks) {
      cb();
    }
  }
}
