import { useState } from "react";
import { WebMCPProvider, useMcpTool, useWebMCPStatus } from "webmcp-react";
import { z } from "zod";
import { DevPanel } from "./components/DevPanel";
import "./App.css";

function SearchTool() {
  useMcpTool({
    name: "search",
    description: "Search the catalog",
    input: z.object({ query: z.string() }),
    handler: async ({ query }) => ({
      content: [{ type: "text", text: `Results for: ${query}` }],
    }),
  });
  return null;
}

function TranslateTool() {
  const { state, execute } = useMcpTool({
    name: "translate",
    description: "Translate text to Spanish",
    input: z.object({ text: z.string() }),
    handler: async ({ text }) => {
      await new Promise((r) => setTimeout(r, 500)); // simulate latency
      const translations: Record<string, string> = {
        Hello: "Hola",
        Goodbye: "Adiós",
        "Thank you": "Gracias",
      };
      const result = translations[text] ?? `[translated] ${text}`;
      return { content: [{ type: "text", text: result }] };
    },
  });

  return (
    <section className="recipe-card">
      <h3>Translate (execution state)</h3>
      <button onClick={() => execute({ text: "Hello" })} disabled={state.isExecuting}>
        {state.isExecuting ? "Translating..." : "Translate \"Hello\""}
      </button>
      {state.lastResult && state.lastResult.content[0].type === "text" && (
        <p className="result">{state.lastResult.content[0].text}</p>
      )}
      {state.error && <p className="error">{state.error.message}</p>}
    </section>
  );
}

function DeleteUserTool() {
  useMcpTool({
    name: "delete_user",
    description: "Permanently delete a user account",
    input: z.object({ userId: z.string() }),
    annotations: {
      destructiveHint: true,
      idempotentHint: true,
    },
    handler: async ({ userId }) => ({
      content: [{ type: "text", text: `Deleted user ${userId}` }],
    }),
  });
  return null;
}

function CheckoutTool() {
  useMcpTool({
    name: "checkout",
    description: "Complete a purchase",
    input: z.object({ cartId: z.string() }),
    handler: async ({ cartId }) => {
      await new Promise((r) => setTimeout(r, 300));
      return { content: [{ type: "text", text: `Order placed for cart ${cartId}` }] };
    },
    onSuccess: (result) => console.log("[onSuccess]", result),
    onError: (error) => console.error("[onError]", error),
  });
  return null;
}

function CalculateTool() {
  useMcpTool({
    name: "calculate",
    description: "Basic arithmetic",
    inputSchema: {
      type: "object",
      properties: {
        a: { type: "number" },
        b: { type: "number" },
        op: { type: "string", enum: ["add", "subtract", "multiply", "divide"] },
      },
      required: ["a", "b", "op"],
    },
    handler: async (args) => {
      const { a, b, op } = args as { a: number; b: number; op: string };
      const result = { add: a + b, subtract: a - b, multiply: a * b, divide: a / b }[op];
      return { content: [{ type: "text", text: String(result) }] };
    },
  });
  return null;
}

function AdminTools() {
  useMcpTool({
    name: "admin_reset",
    description: "Reset all user sessions (admin only)",
    input: z.object({}),
    handler: async () => ({
      content: [{ type: "text", text: "All sessions reset" }],
    }),
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
  const [isAdmin, setIsAdmin] = useState(false);

  return (
    <WebMCPProvider name="playground" version="1.0">
      <div className="app">
        <header className="app-header">
          <h1>webmcp-react playground</h1>
          <StatusBar />
        </header>

        <SearchTool />
        <TranslateTool />
        <DeleteUserTool />
        <CheckoutTool />
        <CalculateTool />

        <section className="recipe-card">
          <h3>Dynamic tools</h3>
          <label>
            <input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />
            Admin mode (toggle to register/unregister admin_reset tool)
          </label>
        </section>
        {isAdmin && <AdminTools />}

        <DevPanel />
      </div>
    </WebMCPProvider>
  );
}
