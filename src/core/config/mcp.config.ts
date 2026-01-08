export interface MCPServerConfig {
  name: string;
  baseUrl: string;
}

export const mcpConfig: { servers: MCPServerConfig[] } = {
  servers: [
    {
      name: "amadeus",
      baseUrl: "https://mcp.ama.one",
    },
    //  MongoDB config can be added here
    // {
    //   name: "mongodb",
    //   baseUrl: "http://localhost:3000/mcp", 
    // }
  ],
};
