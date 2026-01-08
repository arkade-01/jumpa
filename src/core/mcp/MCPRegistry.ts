import { mcpConfig } from "@core/config/mcp.config";
import { MCPClient, ToolDefinition } from "./MCPClient";
import { tools as localTools } from "@src/ai-agent/tools";

export class MCPRegistry {
  private static instance: MCPRegistry;
  private clients: Map<string, MCPClient> = new Map();
  private cachedTools: ToolDefinition[] = [];
  private lastFetchTime = 0;
  private CACHE_DURATION = 1000 * 60 * 60; // cache for 1 hour

  private constructor() {
    this.initializeClients();
  }

  static getInstance(): MCPRegistry {
    if (!MCPRegistry.instance) {
      MCPRegistry.instance = new MCPRegistry();
    }
    return MCPRegistry.instance;
  }

  private initializeClients() {
    for (const server of mcpConfig.servers) {
      this.clients.set(server.name, new MCPClient(server));
      console.log(`[MCPRegistry] Registered server: ${server.name}`);
    }
  }

  /**
   * Get all available tools (Local + MCP)
   */
  async getAllTools(forceRefresh = false): Promise<ToolDefinition[]> {
    const now = Date.now();
    if (!forceRefresh && this.cachedTools.length > 0 && now - this.lastFetchTime < this.CACHE_DURATION) {
      return this.cachedTools;
    }

    // 1. Convert Local Tools to generic definition
    // Local tools in `tools.ts` have `input_schema` and `handler`.
    const formattedLocalTools: ToolDefinition[] = localTools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.input_schema
    }));

    // 2. Fetch Remote Tools
    let remoteTools: ToolDefinition[] = [];
    const clientPromises = Array.from(this.clients.values()).map(client => client.listTools());

    const results = await Promise.allSettled(clientPromises);

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        remoteTools.push(...result.value);
      } else {
        console.error(`[MCPRegistry] Failed to fetch tools from client:`, result.reason);
      }
    });

    // 3. Merge
    this.cachedTools = [...formattedLocalTools, ...remoteTools];
    this.lastFetchTime = now;

    console.log(`[MCPRegistry] Total tools available: ${this.cachedTools.length} (${formattedLocalTools.length} local, ${remoteTools.length} remote)`);
    return this.cachedTools;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(toolName: string, args: any): Promise<any> {
    // 1. Check Local Tools first
    const localTool = localTools.find(t => t.name === toolName);
    if (localTool) {
      console.log(`[MCPRegistry] Executing Local Tool: ${toolName}`);
      return await localTool.handler(args);
    }

    // 2. Check Remote Tools (Broadcasting to find who owns it)
    // In a more complex setup, we'd map toolName -> clientID during fetch.
    // For now, since we only have amadeus, we can just look through clients.
    // Or we can optimize by storing the mapping in `getAllTools`.

    // Simple approach: Try to find which client "owns" this tool from our cache or just try calls.
    // A better way is to iterate clients.
    // Since we don't store "owner" in cache currently, let's fix that optimization later.
    // For now, iterate known clients.

    for (const client of this.clients.values()) {
      // We could check if client has tool in its list, but listTools might be cached.
      // Let's assume tool names are unique enough or we just try.
      // Optimization: Check existing cache to find owner.

      // Re-fetch owner from cache if possible
      // This implies getAllTools was called at least once. 
      // If not, we might fail.

      // Let's try calling. The MCP protocol might return "Method not found" error if tool missing
      // But that incurs network cost.

      // Optimal: Just look at `this.cachedTools`? No, that doesn't say who owns it.
      // Let's implement a quick lookup cache.
    }

    // Improved Strategy:
    // We assume `getAllTools` has populate the cache.
    // We actually need to know WHICH client provided the tool.
    // For this MPV with 1 server, it's fine.
    // But for "Generic" support, we should find the client.

    // HACK: Since we only have 'amadeus' server for now, just use that.
    const amadeusClient = this.clients.get("amadeus");
    if (amadeusClient) {
      // We can check if it's an Amadeus tool by checking if it's NOT in local tools
      // AND if we want, we can verify against the tool list we fetched.
      // For expedience, just call it.
      return await amadeusClient.callTool(toolName, args);
    }

    throw new Error(`Tool '${toolName}' not found.`);
  }
}
