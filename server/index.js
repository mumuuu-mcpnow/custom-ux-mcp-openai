import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import ngrok from "@ngrok/ngrok";
import cors from "cors";

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadComponentBundle() {
  const bundlePath = resolve(__dirname, "../dist/component.js");

  try {
    return readFileSync(bundlePath, "utf8");
  } catch (error) {
    console.error(
      `Failed to read component bundle at ${bundlePath}. Did you run "npm run build" in app/web?`,
      error
    );
    process.exit(1);
  }
}

const componentSource = loadComponentBundle();
const widgetUri = "ui://widget/hello-world.html";

const server = new McpServer({
  name: "hello-custom-ux-server",
  version: "0.1.0",
});

server.registerResource(
  "hello-widget",
  widgetUri,
  {
    title: "Hello World Widget",
    description: "Renders the hello world custom UX component.",
  },
  async () => ({
    contents: [
      {
        uri: widgetUri,
        mimeType: "text/html+skybridge",
        text: `
<div id="hello-root"></div>
<script type="module">
${componentSource}
</script>
        `.trim(),
        _meta: {
          "openai/widgetPrefersBorder": true,
          "openai/widgetDescription":
            "Hello world greeting rendered with the Apps SDK custom UX component.",
        },
      },
    ],
  })
);

server.registerTool(
  "hello_world",
  {
    title: "Render Hello World UI",
    description: "Shows the hello world custom UX component.",
    inputSchema: {
      name: z.string().optional(),
    },
    _meta: {
      "openai/outputTemplate": widgetUri,
      "openai/toolInvocation/invoking": "Preparing the hello world widget…",
      "openai/toolInvocation/invoked": "Displayed the hello world widget.",
    },
  },
  async ({ name }) => {
    const displayName = name?.trim() || "friend";
    const greeting = `Hello, ${displayName}!`;

    return {
      content: [
        {
          type: "text",
          text: `${greeting} The custom UI component contains additional details.`,
        },
      ],
      structuredContent: {
        greeting,
        instructions:
          "Interact with the widget to explore how custom UX works.",
        generatedAt: new Date().toISOString(),
      },
    };
  }
);

let httpServer;
let ngrokListener;
let shuttingDown = false;

function setupShutdownHandlers() {
  const signals = ["SIGINT", "SIGTERM"];
  for (const signal of signals) {
    process.on(signal, () => {
      if (!shuttingDown) {
        shuttingDown = true;
        void shutdown(signal);
      }
    });
  }
}

async function shutdown(signal) {
  console.log(`Received ${signal}. Shutting down MCP server…`);
  try {
    if (ngrokListener) {
      await ngrokListener.close();
      console.log("Closed ngrok listener");
    }
  } catch (error) {
    console.error("Failed to close ngrok listener", error);
  }

  if (httpServer) {
    await new Promise((resolve) => {
      httpServer.close(() => {
        console.log("HTTP server closed");
        resolve();
      });
    });
  }
  process.exit(0);
}

async function main() {
  setupShutdownHandlers();

  const app = express();
  app.use(express.json({ limit: "5mb" }));
  app.use(cors());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  const handler = async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
    });

    res.on("close", () => {
      transport.close().catch((error) => {
        console.error("Failed to close HTTP transport cleanly", error);
      });
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Failed to handle MCP request", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal MCP server error" });
      }
    }
  }
  app.get("/mcp", handler);
  app.post("/mcp", handler);

  const port = Number.parseInt(process.env.PORT ?? "10086", 10);

  httpServer = await new Promise((resolve, reject) => {
    const listener = app
      .listen(port, () => {
        console.log(`Hello MCP server listening on http://localhost:${port}/mcp`);
        resolve(listener);
      })
      .on("error", (error) => {
        reject(error);
      });
  });

  const enableNgrok =
    (process.env.ENABLE_NGROK ?? "true").toLowerCase() !== "false";
  const hasNgrokAuth =
    typeof process.env.NGROK_AUTHTOKEN === "string" &&
    process.env.NGROK_AUTHTOKEN.trim().length > 0;

  if (enableNgrok) {
    if (!hasNgrokAuth) {
      console.warn(
        "ENABLE_NGROK is true but NGROK_AUTHTOKEN is missing. Skipping tunnel."
      );
    } else {
      try {
        ngrokListener = await ngrok.connect({
          addr: port,
          authtoken_from_env: true,
        });
        console.log(`ngrok tunnel established at ${ngrokListener.url() + '/mcp'}`);
      } catch (error) {
        console.error(
          "Unable to establish ngrok tunnel. Verify NGROK_AUTHTOKEN is valid.",
          error
        );
      }
    }
  }
}

main().catch((error) => {
  console.error("Failed to start MCP server", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});