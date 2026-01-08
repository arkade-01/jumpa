import { MCPServerConfig } from "@core/config/mcp.config";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: any;
}

export interface ToolCallResponse {
  result: any;
  error?: any;
}

export class MCPClient {
  private config: MCPServerConfig;

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  get name() {
    return this.config.name;
  }

  /**
   * List available tools from this MCP server
   */
  async listTools(): Promise<ToolDefinition[]> {
    try {
      const response = await fetch(this.config.baseUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/list",
          params: {},
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch tools from ${this.config.name}: ${response.status}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`MCP Error listing tools: ${JSON.stringify(data.error)}`);
      }

      // Map to standard format
      return data.result.tools.map((t: any) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }));

    } catch (error) {
      console.error(`[MCPClient:${this.config.name}] Error listing tools:`, error);
      return [];
    }
  }

  /**
   * Execute a tool
   */
  async callTool(toolName: string, args: any): Promise<any> {
    console.log(`[MCPClient:${this.config.name}] Calling tool: ${toolName}`);

    const response = await fetch(this.config.baseUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error calling tool on ${this.config.name}: ${response.status}`);
    }

    const data = await response.json();

    if (data.error) {
      // Throw simplified error message for the AI
      const errMsg = typeof data.error === 'string' ? data.error : data.error.message || JSON.stringify(data.error);
      throw new Error(errMsg);
    }

    if (!data.result) {
      throw new Error("MCP provider returned no result block");
    }

    return data.result;
  }
}
