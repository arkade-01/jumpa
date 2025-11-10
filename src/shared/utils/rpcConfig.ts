import { Connection, clusterApiUrl } from "@solana/web3.js";
import { config } from "@core/config/config";

let connection: Connection | null = null;
const api_url = config.solMainnet;

export const getSolanaConnection = (): Connection => {
  if (!connection) {
    connection = new Connection(api_url, {
      commitment: "confirmed",
      confirmTransactionInitialTimeout:100000,
      disableRetryOnRateLimit: true,
    });
    
    // Suppress WebSocket error logging (these are non-critical during transaction confirmation)
    try {
      const rpcWebSocket = (connection as any)._rpcWebSocket;
      if (rpcWebSocket) {
        // Override the internal error handler to suppress logging
        rpcWebSocket.on('error', () => {
          // Silently ignore WebSocket errors - transactions use HTTP fallback
        });
      }
    } catch (e) {
      // If we can't suppress the errors, that's okay
      console.log("error suppressing ws errors:", e);
    }
  }
  return connection;
};
