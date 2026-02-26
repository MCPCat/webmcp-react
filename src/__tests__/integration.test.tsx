import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { _resetPolyfillConsumerCount, WebMCPProvider } from "../context";
import { _resetToolOwners, useMcpTool } from "../hooks/useMcpTool";
import { cleanupPolyfill } from "../polyfill";
import type { CallToolResult } from "../types";
import { _resetWarnings } from "../utils/warn";

// ─── Helpers ──────────────────────────────────────────────────────

function makeResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

async function waitForTools(expected: string[]) {
  await waitFor(() => {
    const tools = navigator.modelContextTesting?.listTools() ?? [];
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual([...expected].sort());
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────

afterEach(() => {
  cleanup();
  cleanupPolyfill();
  _resetPolyfillConsumerCount();
  _resetWarnings();
  _resetToolOwners();
  vi.restoreAllMocks();
});

// ─── Tool components ──────────────────────────────────────────────

function GreetTool() {
  useMcpTool({
    name: "greet",
    description: "Say hello",
    input: z.object({ name: z.string() }),
    handler: async ({ name }) => makeResult(`hello ${name}`),
  });
  return null;
}

function MathTool() {
  useMcpTool({
    name: "add",
    description: "Add numbers",
    inputSchema: {
      type: "object",
      properties: { a: { type: "number" }, b: { type: "number" } },
      required: ["a", "b"],
    },
    handler: async (args) => makeResult(String(Number(args.a) + Number(args.b))),
  });
  return null;
}

// ─── Multi-tool composition ───────────────────────────────────────

describe("multi-tool composition", () => {
  it("multiple tools from different components all independently callable", async () => {
    render(
      <WebMCPProvider name="test" version="1.0">
        <GreetTool />
        <MathTool />
      </WebMCPProvider>,
    );

    await waitForTools(["greet", "add"]);

    let greetJson: string | null | undefined;
    let addJson: string | null | undefined;

    await act(async () => {
      greetJson = await navigator.modelContextTesting?.executeTool(
        "greet",
        JSON.stringify({ name: "world" }),
      );
    });

    await act(async () => {
      addJson = await navigator.modelContextTesting?.executeTool(
        "add",
        JSON.stringify({ a: 2, b: 3 }),
      );
    });

    expect(JSON.parse(greetJson ?? "null").content[0].text).toBe("hello world");
    expect(JSON.parse(addJson ?? "null").content[0].text).toBe("5");
  });

  it("unmounting one tool does not affect others", async () => {
    function App({ showGreet }: { showGreet: boolean }) {
      return (
        <WebMCPProvider name="test" version="1.0">
          {showGreet && <GreetTool />}
          <MathTool />
        </WebMCPProvider>
      );
    }

    const { rerender } = render(<App showGreet={true} />);
    await waitForTools(["greet", "add"]);

    rerender(<App showGreet={false} />);
    await waitForTools(["add"]);

    let addJson: string | null | undefined;
    await act(async () => {
      addJson = await navigator.modelContextTesting?.executeTool(
        "add",
        JSON.stringify({ a: 10, b: 20 }),
      );
    });

    expect(JSON.parse(addJson ?? "null").content[0].text).toBe("30");
  });
});

// ─── Route-change simulation ──────────────────────────────────────

describe("route-change simulation", () => {
  function PageATools() {
    useMcpTool({
      name: "page_a_tool",
      description: "Tool from page A",
      handler: async () => makeResult("page A"),
    });
    return null;
  }

  function PageBTools() {
    useMcpTool({
      name: "page_b_tool",
      description: "Tool from page B",
      handler: async () => makeResult("page B"),
    });
    return null;
  }

  it("page swap round-trip: A → B → A with persistent provider", async () => {
    function App({ page }: { page: "A" | "B" }) {
      return (
        <WebMCPProvider name="test" version="1.0">
          {page === "A" ? <PageATools /> : <PageBTools />}
        </WebMCPProvider>
      );
    }

    // Mount page A
    const { rerender } = render(<App page="A" />);
    await waitForTools(["page_a_tool"]);

    // Navigate to page B
    rerender(<App page="B" />);
    await waitForTools(["page_b_tool"]);

    let resultJson: string | null | undefined;
    await act(async () => {
      resultJson = await navigator.modelContextTesting?.executeTool("page_b_tool", "{}");
    });
    expect(JSON.parse(resultJson ?? "null").content[0].text).toBe("page B");

    // Navigate back to page A
    rerender(<App page="A" />);
    await waitForTools(["page_a_tool"]);

    await act(async () => {
      resultJson = await navigator.modelContextTesting?.executeTool("page_a_tool", "{}");
    });
    expect(JSON.parse(resultJson ?? "null").content[0].text).toBe("page A");
  });
});
