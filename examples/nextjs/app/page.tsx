import { ToolDemo } from "./tools";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>webmcp-react Next.js SSR Example</h1>
      <p>
        This page renders server-side. The <code>&lt;ToolDemo&gt;</code> below is
        a client component that registers MCP tools after hydration.
      </p>
      <ToolDemo />
    </main>
  );
}
