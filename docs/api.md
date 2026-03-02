# API Reference

## `<WebMCPProvider>`

Recommended root wrapper for apps using this library.

| Prop       | Type        | Description        |
| ---------- | ----------- | ------------------ |
| `name`     | `string`    | Your app's name    |
| `version`  | `string`    | Your app's version |
| `children` | `ReactNode` | React children     |

On mount, the provider checks for native `navigator.modelContext`. If absent, it installs a minimal in-memory polyfill. It cleans up the polyfill when the last provider unmounts.

`useMcpTool` can still run outside the provider (with a warning), but registration depends on `navigator.modelContext` already being present.

## `useWebMCPStatus()`

Returns the current availability of the WebMCP API.

```tsx
const { available } = useWebMCPStatus();
```

| Field       | Type      | Description                                                                  |
| ----------- | --------- | ---------------------------------------------------------------------------- |
| `available` | `boolean` | `true` once `navigator.modelContext` is ready (always `false` on the server or outside provider) |

## `useMcpTool(config)`

Registers a tool on `navigator.modelContext`. Automatically unregisters on unmount.

### Zod config

| Field         | Type                            | Description                                                    |
| ------------- | ------------------------------- | -------------------------------------------------------------- |
| `name`        | `string`                        | Tool name (must be unique)                                     |
| `description` | `string`                        | Human-readable description                                     |
| `input`       | `z.ZodObject`                   | Zod schema for inputs. Handler receives typed args             |
| `output`      | `z.ZodObject`                   | Optional Zod schema for outputs                                |
| `handler`     | `(args, client) => CallToolResult \| Promise<CallToolResult>` | Tool implementation |
| `annotations` | `ToolAnnotations`               | Optional hints (`title`, `readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) |
| `onSuccess`   | `(result) => void`              | Optional callback on success                                   |
| `onError`     | `(error) => void`               | Optional callback on error                                     |

The `client` argument provides `requestUserInteraction(callback)` for prompting the user during tool execution.
When you call `execute()` directly, this simply invokes the callback.

### JSON Schema config

Same as above, but replace `input` with `inputSchema: InputSchema` and `output` with `outputSchema: OutputSchema`. The handler receives `Record<string, unknown>` instead of typed args.

### Return value

```tsx
const { state, execute, reset } = useMcpTool({ ... });
```

| Field                | Type                              | Description                        |
| -------------------- | --------------------------------- | ---------------------------------- |
| `state.isExecuting`  | `boolean`                         | `true` while the handler is running |
| `state.lastResult`   | `CallToolResult \| null`          | Most recent result                 |
| `state.error`        | `Error \| null`                   | Most recent error                  |
| `state.executionCount` | `number`                        | Total successful executions        |
| `execute(input?)`    | `(input?) => Promise<CallToolResult>` | Manually invoke the tool       |
| `reset()`            | `() => void`                      | Reset state to initial values      |

`execute()` throws if validation or handler logic fails.

The polyfill installs both `navigator.modelContext` (registration API) and `navigator.modelContextTesting` (consumer API with `executeTool()`, `listTools()`). Browser extensions and tests use `modelContextTesting` to discover and invoke tools.
