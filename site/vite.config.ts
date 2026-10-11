import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig, lazyPlugins } from "vite-plus";
import { LOCALES, localePath } from "./src/i18n/locales";

// Listed here, not only in .gitignore: Vercel uploads without .gitignore, writes .vercel/ and
// rewrites vercel.json on its side before the build.
const generated = [
  "node_modules/**",
  "vercel.json",
  "dist/**",
  "src/routeTree.gen.ts",
  ".vercel/**",
  ".tanstack/**",
  ".output/**",
  ".nitro/**",
];

export default defineConfig({
  fmt: { ignorePatterns: generated },
  lint: {
    ignorePatterns: generated,
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    // tsgolint hangs on Vercel's build machines; vercel.json runs tsc there instead.
    options: { typeAware: !process.env.VERCEL, typeCheck: !process.env.VERCEL },
  },
  test: { include: ["src/**/*.test.{ts,tsx}"] },
  resolve: { tsconfigPaths: true },
  // React's plugin must come after Start's.
  plugins: lazyPlugins(() => [
    tanstackStart({
      prerender: {
        enabled: true,
        // Only the five locale pages exist; nothing to discover or crawl.
        autoStaticPathsDiscovery: false,
        crawlLinks: false,
        failOnError: true,
      },
      pages: LOCALES.map((locale) => ({ path: localePath(locale), prerender: { enabled: true } })),
    }),
    viteReact(),
  ]),
});
