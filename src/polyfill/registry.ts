import type { ToolDescriptor } from "../types";

export interface RegistryInternal {
  registerTool(tool: ToolDescriptor): void;
  unregisterTool(name: string): void;
  clearContext(): void;
  getTools(): ReadonlyMap<string, ToolDescriptor>;
  onToolsChanged(callback: (() => void) | null): void;
}

export function createRegistry(): RegistryInternal {
  const tools = new Map<string, ToolDescriptor>();
  let changeCallback: (() => void) | null = null;
  let notificationPending = false;

  function scheduleNotification(): void {
    if (notificationPending) return;
    notificationPending = true;
    queueMicrotask(() => {
      notificationPending = false;
      changeCallback?.();
    });
  }

  return {
    registerTool(tool: ToolDescriptor): void {
      if (typeof tool.name !== "string" || tool.name === "") {
        throw new DOMException("Tool name must be a non-empty string", "InvalidStateError");
      }
      if (typeof tool.description !== "string" || tool.description === "") {
        throw new DOMException("Tool description must be a non-empty string", "InvalidStateError");
      }
      if (typeof tool.execute !== "function") {
        throw new DOMException("Tool execute must be a function", "InvalidStateError");
      }
      if (tools.has(tool.name)) {
        throw new DOMException(`Tool "${tool.name}" is already registered`, "InvalidStateError");
      }

      tools.set(tool.name, {
        ...tool,
        inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      });
      scheduleNotification();
    },

    unregisterTool(name: string): void {
      if (tools.delete(name)) {
        scheduleNotification();
      }
    },

    clearContext(): void {
      if (tools.size > 0) {
        tools.clear();
        scheduleNotification();
      }
    },

    getTools(): ReadonlyMap<string, ToolDescriptor> {
      return tools;
    },

    onToolsChanged(callback: (() => void) | null): void {
      changeCallback = callback;
    },
  };
}
