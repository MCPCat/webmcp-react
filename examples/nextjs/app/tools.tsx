"use client";

import { WebMCPProvider, useMcpTool, useWebMCPStatus } from "webmcp-react";
import { z } from "zod";

function StatusDisplay() {
  const { available } = useWebMCPStatus();
  return (
    <p>
      WebMCP status: <code>{available ? "available" : "not available"}</code>
    </p>
  );
}

function GreetTool() {
  const { state } = useMcpTool({
    name: "greet",
    description: "Greet someone by name",
    input: z.object({
      name: z.string().describe("The name to greet"),
    }),
    handler: async ({ name }) => ({
      content: [{ type: "text", text: `Hello, ${name}!` }],
    }),
  });

  return (
    <div>
      <p>
        Tool &quot;greet&quot; registered. Executions: {state.executionCount}
      </p>
    </div>
  );
}

export function ToolDemo() {
  return (
    <WebMCPProvider name="nextjs-example" version="1.0">
      <StatusDisplay />
      <GreetTool />
    </WebMCPProvider>
  );
}
