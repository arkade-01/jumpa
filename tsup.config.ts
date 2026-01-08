import { defineConfig } from 'tsup';

/**
 * @tsup config
 * Defines the configuration for the tsup build tool
 * currently the included protocols here are  built with esm format
 */
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  clean: true,
  noExternal: ['@amadeus-protocol/sdk', '@noble/curves'],
});
