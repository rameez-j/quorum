import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: { type: 'object'; properties: Record<string, unknown> };
}

type ToolHandler = (name: string, args: Record<string, unknown>) => Promise<unknown>;

export function createMcpProxy(handler: ToolHandler) {
  const server = new McpServer({
    name: 'quorum-proxy',
    version: '0.1.0',
  });

  function setTools(tools: ToolDefinition[]) {
    for (const tool of tools) {
      server.tool(
        tool.name,
        tool.description,
        {},
        async (args) => {
          const result = await handler(tool.name, args as Record<string, unknown>);
          return {
            content: [{ type: 'text' as const, text: JSON.stringify(result) }],
          };
        }
      );
    }
  }

  return { server, setTools };
}
