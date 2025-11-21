// app/api/mcp-public/[transport]/route.ts - Public MCP endpoint (no auth required)

import { createMcpHandler } from "mcp-handler";
import { helloTool, sayHello } from "@/lib/hello";

console.log("🚀 Initializing Public MCP Server (no authentication)");

// Create the MCP handler without auth
const handler = createMcpHandler(
  (server) => {
    console.log("📋 Registering MCP tools (public access)");
    server.tool(
      helloTool.name,
      helloTool.description,
      helloTool.inputSchema,
      sayHello,
    );
  },
  {
    serverInfo: {
      name: "mcp-auth-demo-public",
      version: "1.0.0",
    },
    capabilities: {
      tools: {
        listChanged: false,
      },
      resources: {
        subscribe: false,
      },
    },
  },
  {
    basePath: "/api/mcp-public",
    maxDuration: 60,
    verboseLogs: true,
  },
);

console.log("✅ Public MCP server initialized (no auth required)");

export { handler as GET, handler as POST };
