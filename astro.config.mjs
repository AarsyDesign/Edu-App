import { defineConfig } from "astro/config";
import node from "@astrojs/node";

// Single deployable app (PRD §19): Astro SSR via Node adapter,
// API routes = endpoints Astro biasa (/api/*), tanpa framework tambahan.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: { port: 4321 },
});
