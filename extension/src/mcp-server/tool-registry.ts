import type { AggregatedTool } from "../types";

export class ToolRegistry {
  private tools = new Map<string, AggregatedTool>();
  private changeCallbacks: Array<() => void> = [];

  updateTools(_tools: AggregatedTool[]) {
    // TODO: update tool map, fire change callbacks
  }

  listMcpTools(): Array<{
    name: string;
    description: string;
    inputSchema: object;
  }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.namespacedName,
      description: t.description,
      inputSchema: t.inputSchema ?? { type: "object", properties: {} },
    }));
  }

  async callTool(
    _name: string,
    _args: Record<string, unknown>,
  ): Promise<{ content: Array<{ type: string; text: string }> }> {
    // TODO: route call to correct tab via WebSocket
    throw new Error("Not implemented");
  }

  onToolsChanged(cb: () => void) {
    this.changeCallbacks.push(cb);
  }
}
