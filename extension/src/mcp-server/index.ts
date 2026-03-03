import { ToolRegistry } from "./tool-registry.js";

console.log("[WebMCP Bridge] mcp-server loaded");

const _registry = new ToolRegistry();

// TODO: set up MCP Server with StdioServerTransport
// TODO: set up WebSocketServer for extension communication
// TODO: wire up ListToolsRequestSchema and CallToolRequestSchema handlers
