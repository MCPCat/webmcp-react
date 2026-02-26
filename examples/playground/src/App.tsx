import { WebMCPProvider, useMcpTool, useWebMCPStatus } from "webmcp-react";
import { z } from "zod";
import { DevPanel } from "./components/DevPanel";
import "./App.css";

function GreetTool() {
  useMcpTool({
    name: "greet",
    description: "Greet someone by name",
    input: z.object({
      name: z.string().describe("The name to greet"),
    }),
    handler: async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }),
  });
  return null;
}

function CalculateTool() {
  useMcpTool({
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
    handler: async (args) => {
      await new Promise((r) => setTimeout(r, 500));
      const { a, b, operation } = args as { a: number; b: number; operation: string };
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
  return null;
}

function StatusBar() {
  const { available } = useWebMCPStatus();
  return (
    <p>
      Status: <code>{available ? "available" : "loading..."}</code>
    </p>
  );
}

export default function App() {
  return (
    <WebMCPProvider name="playground" version="1.0">
      <div className="app">
        <header className="app-header">
          <h1>webmcp-react playground</h1>
          <StatusBar />
        </header>
        <GreetTool />
        <CalculateTool />
        <DevPanel />
      </div>
    </WebMCPProvider>
  );
}
