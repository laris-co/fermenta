import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "" keeps every asset URL relative, which is what makes the built bundle
// work under Home Assistant ingress — the add-on is served from a long random
// prefix (/api/hassio_ingress/<token>/) that is not known at build time.
export default defineConfig({
  plugins: [react()],
  base: "",
  build: { outDir: "dist", assetsDir: "assets" },
});
