import { useState, useEffect } from "react";
import "./ExtensionBanner.css";

const CHROME_STORE_URL =
  "https://chromewebstore.google.com/detail/webmcp-bridge/chgjbookknohehmaocfijekhaocaanaf";

const DETECTION_TIMEOUT = 2000;

type Status = "checking" | "connected" | "not-detected";

export function ExtensionBanner() {
  const [status, setStatus] = useState<Status>("checking");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    function handleMessage(event: MessageEvent) {
      if (event.source !== window) return;
      if (event.data?.type === "WEBMCP_TOOLS_UPDATED") {
        clearTimeout(timeout);
        setStatus("connected");
      }
    }

    window.addEventListener("message", handleMessage);

    // Ask the extension to send tools
    window.postMessage({ type: "WEBMCP_REQUEST_TOOLS" }, window.location.origin);

    timeout = setTimeout(() => {
      setStatus((prev) => (prev === "checking" ? "not-detected" : prev));
    }, DETECTION_TIMEOUT);

    return () => {
      window.removeEventListener("message", handleMessage);
      clearTimeout(timeout);
    };
  }, []);

  if (status === "checking" || dismissed) return null;

  if (status === "connected") {
    return (
      <div className="extension-banner extension-banner--connected">
        <div className="extension-banner__content">
          <span className="extension-banner__dot" />
          WebMCP Bridge extension connected
        </div>
      </div>
    );
  }

  return (
    <div className="extension-banner extension-banner--not-detected">
      <div className="extension-banner__content">
        <span className="extension-banner__dot" />
        <span>
          <strong>Not connected</strong> — install or activate the{" "}
          <a href={CHROME_STORE_URL} target="_blank" rel="noopener noreferrer">
            WebMCP Bridge extension
          </a>{" "}
          to expose your tools to AI clients.
        </span>
      </div>
      <button
        className="extension-banner__dismiss"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
      >
        &times;
      </button>
    </div>
  );
}
