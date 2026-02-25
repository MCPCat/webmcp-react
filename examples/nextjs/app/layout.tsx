import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "webmcp-react Next.js SSR Example",
  description: "Validates SSR safety of webmcp-react hooks",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
