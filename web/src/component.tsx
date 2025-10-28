import { StrictMode, use, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { useCortexGlobalAction, useCortexGlobalState } from "@cortex-app/sdk-widget-sandbox/hooks";

const rootElement = document.getElementById("hello-root");

if (!rootElement) {
  throw new Error('Missing mount node with id "hello-root"');
}

window.parent.onmessage = (event) => {
  console.log("Received message from parent:", event);
};
function App() {
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState("Thanks for the hello world demo!");
  const theme = useCortexGlobalState("theme");
  const sendFollowUpMessage = useCortexGlobalAction("sendFollowUpMessage")
  const callTool = useCortexGlobalAction("callTool");
  const toolOutput = useCortexGlobalState("toolOutput");

  const structuredContent = useMemo(() => {
    return (
      (toolOutput?.structuredContent as Record<string, unknown>) ??
      {}
    );
  }, [toolOutput]);

  const greeting =
    (structuredContent.greeting as string | undefined) ??
    "Hello from your custom UX component!";

  const instructions =
    (structuredContent.instructions as string | undefined) ??
    "This UI was rendered from the MCP server response.";

  const handleSendFollowUp = async () => {
    const trimmed = message.trim();
    if (!trimmed) {
      setStatus("Please enter a message before sending.");
      return;
    }

    if(window.openai.widgetState) {
      console.log(window.openai.widgetState.sessionId)
    }

    if (!window.openai.sendFollowUpMessage) {
      setStatus("Host does not support follow-up messages yet.");
      return;
    }

    try {
      setStatus("Sending follow-up…");
      await window.openai.sendFollowUpMessage({
        prompt: trimmed,
      });
      setMessage("");
      setStatus("Follow-up sent back to the conversation.");
    } catch (error) {
      console.error("Failed to send follow-up", error);
      setStatus("Unable to send follow-up message.");
    }
  };

  const handleCallTool = async () => {
    const result = await callTool("testaaa", { foo: "bar" });
    console.log("sandbox widget call tool get result:", result);
  };

  return (
    <main
      style={{
        fontFamily:
          "Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        padding: "0",
        margin: "0",
        backgroundColor: "#f8fafc",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
      }}
    >
      <h1
        style={{ fontSize: "1.8rem", marginBottom: "0.5rem", color: "#0f172a" }}
      >
        {greeting}
        current theme: {theme}
      </h1>
      <p style={{ marginBottom: "1rem", color: "#334155" }}>{instructions}</p>

      <section
        style={{
          padding: "1rem",
          backgroundColor: "#0f172a",
          color: "white",
          borderRadius: "8px",
          marginBottom: "1rem",
          fontFamily:
            "ui-monospace, SFMono-Regular, SFMono, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: "0.85rem",
          lineHeight: 1.5,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
        }}
      >
        {JSON.stringify(structuredContent, null, 2)}
      </section>

      <label
        htmlFor="followup-message"
        style={{
          display: "block",
          fontWeight: 600,
          marginBottom: "0.5rem",
          color: "#0f172a",
        }}
      >
        Follow-up message
      </label>
      <input
        id="followup-message"
        value={message}
        onChange={(event) => setMessage(event.target.value)}
        placeholder="Type a response to send back to chat"
        style={{
          width: "100%",
          padding: "0.75rem",
          borderRadius: "8px",
          border: "1px solid #cbd5f5",
          marginBottom: "0.75rem",
          fontSize: "1rem",
        }}
      />

      <button
        type="button"
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#8aafffff",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background-color 0.2s ease",
        }}
        onClick={handleCallTool}
      >
        Trigger ToolCall
      </button>

      <button
        type="button"
        onClick={handleSendFollowUp}
        style={{
          padding: "0.75rem 1rem",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#2563eb",
          color: "white",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background-color 0.2s ease",
        }}
        onMouseEnter={(event) => {
          (event.currentTarget as HTMLButtonElement).style.backgroundColor =
            "#1d4ed8";
        }}
        onMouseLeave={(event) => {
          (event.currentTarget as HTMLButtonElement).style.backgroundColor =
            "#2563eb";
        }}
      >
        Send message to chat
      </button>

      {status && (
        <p style={{ marginTop: "0.75rem", color: "#0f172a" }}>{status}</p>
      )}
    </main>
  );
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>
);
