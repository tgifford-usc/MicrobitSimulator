import { defineConfig } from "vite";

export default defineConfig({
  server: {
    host: "0.0.0.0",          // required for Docker
    port: 5173,
    allowedHosts: [
      "makecode.offig.com"
    ],
  },
});
