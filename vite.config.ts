import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";

import manifest from "./src/manifest";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  return {
    build: {
      emptyOutDir: true,
      outDir: mode === "firefox" ? "build-firefox" : "build",
      rolldownOptions: {
        output: {
          chunkFileNames: "assets/chunk-[hash].js",
        },
      },
    },

    plugins: [
      crx({ manifest, browser: mode === "firefox" ? "firefox" : "chrome" }),
    ],
  };
});
