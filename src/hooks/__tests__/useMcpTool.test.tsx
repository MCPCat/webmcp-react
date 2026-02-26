import { act, cleanup, render, waitFor } from "@testing-library/react";
import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { _resetPolyfillConsumerCount, WebMCPProvider } from "../../context";
import { cleanupPolyfill } from "../../polyfill";
import type { CallToolResult, McpToolConfigJsonSchema, McpToolConfigZod } from "../../types";
import { _resetWarnings } from "../../utils/warn";
import { _resetToolOwners, useMcpTool } from "../useMcpTool";

// ─── Helpers ──────────────────────────────────────────────────────

const OK_RESULT: CallToolResult = {
  content: [{ type: "text", text: "ok" }],
};

function makeResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function renderWithProvider(ui: React.ReactElement) {
  return render(
    <WebMCPProvider name="test" version="1.0">
      {ui}
    </WebMCPProvider>,
  );
}

/** Wait for the provider to install the polyfill and tools to register. */
async function waitForRegistration() {
  await waitFor(() => {
    expect(navigator.modelContextTesting).toBeDefined();
  });
  // Let microtasks (tool change notifications) settle
  await act(async () => {});
}

type ExecuteFn = ReturnType<typeof useMcpTool>["execute"];
type ResetFn = ReturnType<typeof useMcpTool>["reset"];
type ToolConfig = McpToolConfigZod<z.ZodRawShape> | McpToolConfigJsonSchema;

// ─── Test component ──────────────────────────────────────────────

function ToolComponent({
  config,
  onState,
  onExecuteRef,
  onResetRef,
}: {
  config: ToolConfig;
  onState?: (state: ReturnType<typeof useMcpTool>["state"]) => void;
  onExecuteRef?: React.MutableRefObject<ExecuteFn | null>;
  onResetRef?: React.MutableRefObject<ResetFn | null>;
}) {
  const { state, execute, reset } = useMcpTool(config as McpToolConfigJsonSchema);
  onState?.(state);
  if (onExecuteRef) onExecuteRef.current = execute;
  if (onResetRef) onResetRef.current = reset;
  return (
    <div>
      <span data-testid="executing">{state.isExecuting ? "yes" : "no"}</span>
      <span data-testid="error">{state.error?.message ?? "none"}</span>
      <span data-testid="count">{state.executionCount}</span>
      <span data-testid="result">
        {state.lastResult
          ? state.lastResult.content.map((c) => ("text" in c ? c.text : "")).join("")
          : "null"}
      </span>
    </div>
  );
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

// ─── Registration lifecycle ──────────────────────────────────────

describe("registration lifecycle", () => {
  it("registers tool with Zod schema on mount", async () => {
    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          input: z.object({ name: z.string() }),
          handler: async () => OK_RESULT,
        }}
      />,
    );

    await waitForRegistration();

    const tools = navigator.modelContextTesting?.listTools() ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("greet");
    expect(tools[0].description).toBe("Say hello");

    const schema = JSON.parse(tools[0].inputSchema ?? "{}");
    expect(schema.type).toBe("object");
    expect(schema.properties.name.type).toBe("string");
    expect(schema.required).toContain("name");
  });

  it("registers tool with JSON Schema on mount", async () => {
    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" } },
            required: ["name"],
          },
          handler: async () => OK_RESULT,
        }}
      />,
    );

    await waitForRegistration();

    const tools = navigator.modelContextTesting?.listTools() ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("greet");
  });

  it("registers with annotations and output schema", async () => {
    const { rerender } = render(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            input: z.object({ name: z.string() }),
            output: z.object({ greeting: z.string() }),
            annotations: { readOnlyHint: true, title: "Greeter" },
            handler: async () => OK_RESULT,
          }}
        />
      </WebMCPProvider>,
    );

    await waitForRegistration();

    // listTools() only returns name/description/inputSchema, so spy on registerTool
    // and trigger re-registration by changing description.
    const mc = navigator.modelContext;
    expect(mc).toBeDefined();
    const spy = vi.spyOn(mc as NonNullable<typeof mc>, "registerTool");

    rerender(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello v2",
            input: z.object({ name: z.string() }),
            output: z.object({ greeting: z.string() }),
            annotations: { readOnlyHint: true, title: "Greeter" },
            handler: async () => OK_RESULT,
          }}
        />
      </WebMCPProvider>,
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const descriptor = spy.mock.calls[spy.mock.calls.length - 1][0];
    expect(descriptor.annotations).toEqual({
      readOnlyHint: true,
      title: "Greeter",
    });
    expect(descriptor.outputSchema).toBeDefined();
    expect(descriptor.outputSchema?.properties?.greeting).toBeDefined();
  });

  it("unregisters tool on unmount", async () => {
    const { unmount } = renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string" } },
          },
          handler: async () => OK_RESULT,
        }}
      />,
    );

    await waitForRegistration();
    expect(navigator.modelContextTesting?.listTools()).toHaveLength(1);

    // Spy before unmount — provider cleanup will remove the polyfill
    const mc = navigator.modelContext;
    expect(mc).toBeDefined();
    const spy = vi.spyOn(mc as NonNullable<typeof mc>, "unregisterTool");

    unmount();

    expect(spy).toHaveBeenCalledWith("greet");
  });

  it("re-registers when description changes", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;

    const { rerender } = render(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
            handler: async () => OK_RESULT,
          }}
          onExecuteRef={executeRef}
        />
      </WebMCPProvider>,
    );

    await waitForRegistration();

    const mc = navigator.modelContext;
    expect(mc).toBeDefined();
    const spy = vi.spyOn(mc as NonNullable<typeof mc>, "registerTool");

    rerender(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello v2",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
            handler: async () => OK_RESULT,
          }}
          onExecuteRef={executeRef}
        />
      </WebMCPProvider>,
    );

    await waitFor(() => {
      expect(spy).toHaveBeenCalled();
    });

    const tools = navigator.modelContextTesting?.listTools() ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].description).toBe("Say hello v2");
  });

  it("does NOT re-register when handler changes", async () => {
    const { rerender } = render(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
            handler: async () => makeResult("first"),
          }}
        />
      </WebMCPProvider>,
    );

    await waitForRegistration();

    const mc = navigator.modelContext;
    expect(mc).toBeDefined();
    const spy = vi.spyOn(mc as NonNullable<typeof mc>, "registerTool");

    rerender(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            inputSchema: {
              type: "object",
              properties: { name: { type: "string" } },
            },
            handler: async () => makeResult("second"),
          }}
        />
      </WebMCPProvider>,
    );

    // Give any potential effect a chance to run
    await act(async () => {});

    expect(spy).not.toHaveBeenCalled();
  });
});

// ─── Strict Mode safety ──────────────────────────────────────────

describe("Strict Mode safety", () => {
  it("one tool visible after Strict Mode double-mount", async () => {
    render(
      <StrictMode>
        <WebMCPProvider name="test" version="1.0">
          <ToolComponent
            config={{
              name: "greet",
              description: "Say hello",
              input: z.object({ name: z.string() }),
              handler: async () => OK_RESULT,
            }}
          />
        </WebMCPProvider>
      </StrictMode>,
    );

    await waitForRegistration();

    const tools = navigator.modelContextTesting?.listTools() ?? [];
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe("greet");
  });

  it("tool unregistered on real unmount in Strict Mode", async () => {
    const { unmount } = render(
      <StrictMode>
        <WebMCPProvider name="test" version="1.0">
          <ToolComponent
            config={{
              name: "greet",
              description: "Say hello",
              input: z.object({ name: z.string() }),
              handler: async () => OK_RESULT,
            }}
          />
        </WebMCPProvider>
      </StrictMode>,
    );

    await waitForRegistration();
    expect(navigator.modelContextTesting?.listTools()).toHaveLength(1);

    const mc = navigator.modelContext;
    expect(mc).toBeDefined();
    const spy = vi.spyOn(mc as NonNullable<typeof mc>, "unregisterTool");

    unmount();

    expect(spy).toHaveBeenCalledWith("greet");
  });
});

// ─── Execution state ─────────────────────────────────────────────

describe("execution state", () => {
  it("returns correct initial state", async () => {
    const states: ReturnType<typeof useMcpTool>["state"][] = [];

    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          handler: async () => OK_RESULT,
        }}
        onState={(s) => states.push(s)}
      />,
    );

    expect(states[0]).toEqual({
      isExecuting: false,
      lastResult: null,
      error: null,
      executionCount: 0,
    });
  });

  it("Zod tool succeeds when execute() is called with no args", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;

    renderWithProvider(
      <ToolComponent
        config={{
          name: "noop",
          description: "No-arg tool",
          input: z.object({}),
          handler: async () => OK_RESULT,
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    await act(async () => {
      await executeRef.current?.();
    });

    expect(document.querySelector("[data-testid='count']")?.textContent).toBe("1");
  });

  it("updates state on successful execution", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;
    const result = makeResult("hello world");

    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          handler: async () => result,
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    await act(async () => {
      await executeRef.current?.();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='executing']")?.textContent).toBe("no");
    });

    expect(document.querySelector("[data-testid='count']")?.textContent).toBe("1");
    expect(document.querySelector("[data-testid='result']")?.textContent).toBe("hello world");
  });

  it("sets error state on handler error and re-throws", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;

    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          handler: async () => {
            throw new Error("handler failed");
          },
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await executeRef.current?.();
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError).toBeDefined();
    expect(caughtError?.message).toBe("handler failed");

    expect(document.querySelector("[data-testid='error']")?.textContent).toBe("handler failed");
  });

  it("sets error state on Zod validation error and re-throws", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;

    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          input: z.object({ name: z.string() }),
          handler: async () => OK_RESULT,
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    let caughtError: Error | undefined;
    await act(async () => {
      try {
        await executeRef.current?.({ name: 123 as unknown as string });
      } catch (e) {
        caughtError = e as Error;
      }
    });

    expect(caughtError).toBeDefined();
    expect(document.querySelector("[data-testid='error']")?.textContent).not.toBe("none");
  });

  it("calls onSuccess and onError callbacks (latest via ref)", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;
    const onSuccess = vi.fn();
    const onError = vi.fn();

    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          handler: async () => OK_RESULT,
          onSuccess,
          onError,
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    await act(async () => {
      await executeRef.current?.();
    });

    expect(onSuccess).toHaveBeenCalledWith(OK_RESULT);
    expect(onError).not.toHaveBeenCalled();
  });

  it("reset restores initial state", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;
    const resetRef = { current: null } as React.MutableRefObject<ResetFn | null>;

    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          handler: async () => OK_RESULT,
        }}
        onExecuteRef={executeRef}
        onResetRef={resetRef}
      />,
    );

    await waitForRegistration();

    await act(async () => {
      await executeRef.current?.();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='count']")?.textContent).toBe("1");
    });

    act(() => {
      resetRef.current?.();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='count']")?.textContent).toBe("0");
      expect(document.querySelector("[data-testid='result']")?.textContent).toBe("null");
    });
  });

  it("overlapping executions keep isExecuting true until all complete", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;
    let resolve1: (v: CallToolResult) => void;
    let resolve2: (v: CallToolResult) => void;
    let callCount = 0;

    renderWithProvider(
      <ToolComponent
        config={{
          name: "slow",
          description: "Slow tool",
          handler: () => {
            callCount++;
            return new Promise<CallToolResult>((r) => {
              if (callCount === 1) resolve1 = r;
              else resolve2 = r;
            });
          },
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    // Start two concurrent executions
    let p1: Promise<CallToolResult> | undefined;
    let p2: Promise<CallToolResult> | undefined;
    act(() => {
      p1 = executeRef.current?.();
      p2 = executeRef.current?.();
    });

    await waitFor(() => {
      expect(document.querySelector("[data-testid='executing']")?.textContent).toBe("yes");
    });

    // Complete first — isExecuting should still be true
    await act(async () => {
      resolve1(makeResult("first"));
      await p1;
    });

    expect(document.querySelector("[data-testid='executing']")?.textContent).toBe("yes");

    // Complete second — now isExecuting should be false
    await act(async () => {
      resolve2(makeResult("second"));
      await p2;
    });

    expect(document.querySelector("[data-testid='executing']")?.textContent).toBe("no");
  });
});

// ─── MCP integration ─────────────────────────────────────────────

describe("MCP integration", () => {
  it("executeTool calls handler and returns result JSON", async () => {
    renderWithProvider(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          input: z.object({ name: z.string() }),
          handler: async ({ name }) => makeResult(`hello ${name}`),
        }}
      />,
    );

    await waitForRegistration();

    let resultJson: string | null | undefined;
    await act(async () => {
      resultJson = await navigator.modelContextTesting?.executeTool(
        "greet",
        JSON.stringify({ name: "world" }),
      );
    });

    const result = JSON.parse(resultJson ?? "null");
    expect(result.content[0].text).toBe("hello world");
  });

  it("handler error returns isError through MCP (no throw)", async () => {
    renderWithProvider(
      <ToolComponent
        config={{
          name: "fail",
          description: "Always fails",
          handler: async () => {
            throw new Error("boom");
          },
        }}
      />,
    );

    await waitForRegistration();

    let resultJson: string | null | undefined;
    await act(async () => {
      resultJson = await navigator.modelContextTesting?.executeTool("fail", "{}");
    });

    const result = JSON.parse(resultJson ?? "null");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Error: boom");
  });

  it("latest handler is always called via ref", async () => {
    const handler1 = vi.fn(async () => makeResult("v1"));
    const handler2 = vi.fn(async () => makeResult("v2"));

    const { rerender } = render(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            handler: handler1,
          }}
        />
      </WebMCPProvider>,
    );

    await waitForRegistration();

    // Update handler without changing registration deps
    rerender(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            handler: handler2,
          }}
        />
      </WebMCPProvider>,
    );

    let resultJson: string | null | undefined;
    await act(async () => {
      resultJson = await navigator.modelContextTesting?.executeTool("greet", "{}");
    });

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalled();

    const result = JSON.parse(resultJson ?? "null");
    expect(result.content[0].text).toBe("v2");
  });
});

// ─── SSR safety ──────────────────────────────────────────────────

describe("SSR safety", () => {
  it("renderToString does not throw and returns initial state markup", () => {
    const html = renderToString(
      <WebMCPProvider name="test" version="1.0">
        <ToolComponent
          config={{
            name: "greet",
            description: "Say hello",
            handler: async () => OK_RESULT,
          }}
        />
      </WebMCPProvider>,
    );

    expect(html).toContain("no"); // isExecuting: no
    expect(html).toContain("none"); // error: none
    expect(html).toContain("0"); // executionCount: 0
  });

  it("registration effect does not fire during SSR", () => {
    // During SSR, typeof navigator is "undefined" in Node, but jsdom provides it.
    // Verify no tool is registered synchronously during renderToString.
    // After renderToString, navigator.modelContext should not exist (no provider effect ran).
    const prevMc = navigator.modelContext;
    delete navigator.modelContext;

    try {
      renderToString(
        <WebMCPProvider name="test" version="1.0">
          <ToolComponent
            config={{
              name: "greet",
              description: "Say hello",
              handler: async () => OK_RESULT,
            }}
          />
        </WebMCPProvider>,
      );

      // No modelContext should exist — effects don't run during renderToString
      expect(navigator.modelContext).toBeUndefined();
    } finally {
      if (prevMc) {
        Object.defineProperty(navigator, "modelContext", {
          value: prevMc,
          configurable: true,
          enumerable: true,
          writable: false,
        });
      }
    }
  });
});

// ─── Unmount safety ──────────────────────────────────────────────

describe("unmount safety", () => {
  it("does not update state after unmount during async handler", async () => {
    const executeRef = { current: null } as React.MutableRefObject<ExecuteFn | null>;
    let resolveHandler: (v: CallToolResult) => void;

    const { unmount } = renderWithProvider(
      <ToolComponent
        config={{
          name: "slow",
          description: "Slow tool",
          handler: () =>
            new Promise<CallToolResult>((r) => {
              resolveHandler = r;
            }),
        }}
        onExecuteRef={executeRef}
      />,
    );

    await waitForRegistration();

    // Start execution, then unmount before it completes
    let executePromise: Promise<CallToolResult> | undefined;
    act(() => {
      executePromise = executeRef.current?.();
    });

    unmount();

    // Spy on console.error to verify no "setState on unmounted component" warning
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    // Resolve after unmount
    await act(async () => {
      resolveHandler(OK_RESULT);
      await executePromise;
    });

    // React 18 removed the warning, but we verify no errors occurred
    const relevantErrors = errorSpy.mock.calls.filter(
      (call) => typeof call[0] === "string" && call[0].includes("unmounted"),
    );
    expect(relevantErrors).toHaveLength(0);
  });
});

// ─── Provider warning ────────────────────────────────────────────

describe("provider warning", () => {
  it("warns when used outside WebMCPProvider", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});

    render(
      <ToolComponent
        config={{
          name: "greet",
          description: "Say hello",
          handler: async () => OK_RESULT,
        }}
      />,
    );

    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("useMcpTool is being used outside <WebMCPProvider>"),
    );
  });
});
