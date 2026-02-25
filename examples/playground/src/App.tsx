import { useEffect, useState } from "react";
import { DevPanel } from "./components/DevPanel";
import "./App.css";

// Phase 1: Temporary inline polyfill.
// Replaced by the real polyfill once MCP-8 lands, then by <WebMCPProvider> after MCP-11.
function installPolyfill() {
  if ((navigator as any).modelContext) return;

  type ToolDef = {
    name: string;
    description: string;
    inputSchema: unknown;
    outputSchema?: unknown;
    execute: (input: unknown) => unknown;
  };

  const tools = new Map<string, ToolDef>();

  (navigator as any).modelContext = {
    registerTool(toolDef: ToolDef) {
      if (tools.has(toolDef.name)) {
        throw new DOMException(
          `Tool "${toolDef.name}" is already registered`,
          "InvalidStateError",
        );
      }
      tools.set(toolDef.name, toolDef);
    },
    unregisterTool(name: string) {
      if (!tools.delete(name)) {
        throw new DOMException(`Tool "${name}" is not registered`, "NotFoundError");
      }
    },
  };

  (navigator as any).modelContextTesting = {
    listTools() {
      return Array.from(tools.values()).map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: JSON.stringify(t.inputSchema),
        ...(t.outputSchema ? { outputSchema: JSON.stringify(t.outputSchema) } : {}),
      }));
    },
    async executeTool(name: string, inputJson: string) {
      const tool = tools.get(name);
      if (!tool) {
        throw new DOMException(`Tool "${name}" not found`, "NotFoundError");
      }
      const result: any = await tool.execute(JSON.parse(inputJson));
      if (result?.isError) {
        const text = result.content?.[0]?.text ?? "Unknown error";
        throw new DOMException(text, "OperationError");
      }
      return JSON.stringify(result);
    },
  };
}

// Phase 1: Register tools directly against the polyfill.
// Replaced by hook-based tool components after MCP-12.
function DirectTools() {
  useEffect(() => {
    const mc = (navigator as any).modelContext;
    if (!mc) return;

    mc.registerTool({
      name: "greet",
      description: "Greet someone by name",
      inputSchema: {
        type: "object",
        properties: {
          name: { type: "string", description: "The name to greet" },
        },
        required: ["name"],
      },
      execute: (input: any) => ({
        content: [{ type: "text", text: `Hello, ${input.name}!` }],
      }),
    });

    mc.registerTool({
      name: "calculate",
      description: "Perform basic arithmetic",
      inputSchema: {
        type: "object",
        properties: {
          a: { type: "number", description: "First operand" },
          b: { type: "number", description: "Second operand" },
          operation: {
            type: "string",
            enum: ["add", "subtract", "multiply", "divide"],
            description: "The operation to perform",
          },
        },
        required: ["a", "b", "operation"],
      },
      outputSchema: {
        type: "object",
        properties: {
          result: { type: "number" },
        },
      },
      execute: async (input: any) => {
        await new Promise((r) => setTimeout(r, 500));
        const { a, b, operation } = input;
        if (operation === "divide" && b === 0) {
          return {
            content: [{ type: "text", text: "Division by zero" }],
            isError: true,
          };
        }
        const ops: Record<string, number> = {
          add: a + b,
          subtract: a - b,
          multiply: a * b,
          divide: a / b,
        };
        return {
          content: [{ type: "text", text: `${a} ${operation} ${b} = ${ops[operation]}` }],
          structuredContent: { result: ops[operation] },
        };
      },
    });

    return () => {
      try {
        mc.unregisterTool("greet");
      } catch {}
      try {
        mc.unregisterTool("calculate");
      } catch {}
    };
  }, []);

  return null;
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    installPolyfill();
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <div className="app">
      <header className="app-header">
        <h1>webmcp-react playground</h1>
        <p>
          Tools are registered via <code>navigator.modelContext</code>. Use the DevPanel to
          inspect and execute them.
        </p>
      </header>
      <DirectTools />
      <DevPanel />
    </div>
  );
}
