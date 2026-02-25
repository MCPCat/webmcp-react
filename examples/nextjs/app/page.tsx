// This is a Server Component. It validates that importing webmcp-react
// in an SSR context doesn't crash (no navigator, no window).
// Once hooks are implemented (MCP-11, MCP-12), this page will render
// client components that use <WebMCPProvider> and useMcpTool.

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>webmcp-react SSR Example</h1>
      <p>
        This page renders server-side. Once hooks land, client components here will use{" "}
        <code>&lt;WebMCPProvider&gt;</code> and <code>useMcpTool</code> to validate:
      </p>
      <ul>
        <li>Server render doesn't crash (no navigator/window)</li>
        <li>Client hydration activates the polyfill and registers tools</li>
        <li>"use client" directive works correctly in App Router</li>
      </ul>
    </main>
  );
}
