// Primary API types — the minimal set most consumers need.
// The full type surface is available via the "webmcp-react/types" subpath:
//   import type { ... } from "webmcp-react/types"

export { useWebMCPStatus, WebMCPProvider } from "./context";
export { useMcpTool } from "./hooks/useMcpTool";
export type {
  CallToolResult,
  McpToolConfigJsonSchema,
  McpToolConfigZod,
  ToolAnnotations,
  ToolExecutionState,
  UseMcpToolReturn,
  WebMCPProviderProps,
  WebMCPStatus,
} from "./types";
