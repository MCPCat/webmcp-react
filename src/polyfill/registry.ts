import type { RegisterToolOptions, ToolDescriptor } from "../types";

export interface RegistryInternal {
  registerTool(tool: ToolDescriptor, options?: RegisterToolOptions): void;
  unregisterTool(name: string): void;
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
    registerTool(tool: ToolDescriptor, options?: RegisterToolOptions): void {
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

      if (options?.signal?.aborted) {
        return;
      }

      tools.set(tool.name, {
        ...tool,
        inputSchema: tool.inputSchema ?? { type: "object", properties: {} },
      });
      scheduleNotification();

      if (options?.signal) {
        const name = tool.name;
        const stored = tools.get(name);
        options.signal.addEventListener(
          "abort",
          () => {
            if (tools.get(name) === stored && tools.delete(name)) {
              scheduleNotification();
            }
          },
          { once: true },
        );
      }
    },

    unregisterTool(name: string): void {
      if (tools.delete(name)) {
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
