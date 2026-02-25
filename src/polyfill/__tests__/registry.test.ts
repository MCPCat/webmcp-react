import { describe, expect, it, vi } from "vitest";
import type { ToolDescriptor } from "../../types";
import { createRegistry } from "../registry";

function makeTool(overrides?: Partial<ToolDescriptor>): ToolDescriptor {
  return {
    name: "test_tool",
    description: "A test tool",
    execute: async () => ({ content: [{ type: "text", text: "ok" }] }),
    ...overrides,
  };
}

describe("createRegistry", () => {
  it("registers a tool visible in getTools()", () => {
    const registry = createRegistry();
    registry.registerTool(makeTool());
    expect(registry.getTools().has("test_tool")).toBe(true);
  });

  it("defaults inputSchema when absent", () => {
    const registry = createRegistry();
    registry.registerTool(makeTool({ inputSchema: undefined }));
    const stored = registry.getTools().get("test_tool");
    expect(stored?.inputSchema).toEqual({ type: "object", properties: {} });
  });

  it("preserves provided inputSchema", () => {
    const registry = createRegistry();
    const schema = {
      type: "object",
      properties: { q: { type: "string" } },
      required: ["q"] as const,
    };
    registry.registerTool(makeTool({ inputSchema: schema }));
    const stored = registry.getTools().get("test_tool");
    expect(stored?.inputSchema).toEqual(schema);
  });

  it("throws on duplicate name", () => {
    const registry = createRegistry();
    registry.registerTool(makeTool());
    expect(() => registry.registerTool(makeTool())).toThrow(
      'Tool "test_tool" is already registered',
    );
  });

  it("throws on empty name", () => {
    const registry = createRegistry();
    expect(() => registry.registerTool(makeTool({ name: "" }))).toThrow(
      "Tool name must be a non-empty string",
    );
  });

  it("throws on empty description", () => {
    const registry = createRegistry();
    expect(() => registry.registerTool(makeTool({ description: "" }))).toThrow(
      "Tool description must be a non-empty string",
    );
  });

  it("throws on non-function execute", () => {
    const registry = createRegistry();
    expect(() =>
      registry.registerTool(
        makeTool({ execute: "not a function" as unknown as ToolDescriptor["execute"] }),
      ),
    ).toThrow("Tool execute must be a function");
  });

  it("throws DOMException with InvalidStateError name", () => {
    const registry = createRegistry();
    try {
      registry.registerTool(makeTool({ name: "" }));
    } catch (e) {
      expect(e).toBeInstanceOf(DOMException);
      expect((e as DOMException).name).toBe("InvalidStateError");
    }
  });

  it("unregisters a tool", () => {
    const registry = createRegistry();
    registry.registerTool(makeTool());
    registry.unregisterTool("test_tool");
    expect(registry.getTools().has("test_tool")).toBe(false);
  });

  it("unregisterTool no-ops for unknown name", () => {
    const registry = createRegistry();
    expect(() => registry.unregisterTool("nonexistent")).not.toThrow();
  });

  it("clearContext empties all tools", () => {
    const registry = createRegistry();
    registry.registerTool(makeTool({ name: "a" }));
    registry.registerTool(makeTool({ name: "b" }));
    registry.clearContext();
    expect(registry.getTools().size).toBe(0);
  });

  it("clearContext no-ops when already empty", async () => {
    const registry = createRegistry();
    const cb = vi.fn();
    registry.onToolsChanged(cb);
    registry.clearContext();
    await Promise.resolve();
    expect(cb).not.toHaveBeenCalled();
  });

  it("batches rapid registrations into one notification", async () => {
    const registry = createRegistry();
    const cb = vi.fn();
    registry.onToolsChanged(cb);

    registry.registerTool(makeTool({ name: "a" }));
    registry.registerTool(makeTool({ name: "b" }));
    registry.registerTool(makeTool({ name: "c" }));

    expect(cb).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("fires notification after microtask for single registration", async () => {
    const registry = createRegistry();
    const cb = vi.fn();
    registry.onToolsChanged(cb);

    registry.registerTool(makeTool());
    expect(cb).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("stores a shallow copy isolated from the original object", () => {
    const registry = createRegistry();
    const tool = makeTool();
    registry.registerTool(tool);

    (tool as Record<string, unknown>).description = "mutated";
    const stored = registry.getTools().get("test_tool");
    expect(stored?.description).toBe("A test tool");
  });
});
