import { defineConfig } from "tsdown";

export default defineConfig([
  // ESM build for bundlers (motion stays an external dependency)
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    platform: "browser",
    dts: true,
    clean: true,
    sourcemap: true,
    minify: true,
    target: "es2020",
    outDir: "dist",
    fixedExtension: false,
    onSuccess: "lightningcss src/css/mos.css -o dist/mos.css --minify",
  },
  // Standalone build for <script> tags / CDNs: exposes `window.MOS`, motion bundled in
  {
    entry: { "mos.global": "src/global.ts" },
    format: ["iife"],
    globalName: "MOS",
    platform: "browser",
    deps: { alwaysBundle: ["motion"], onlyBundle: false },
    outputOptions: { entryFileNames: "mos.global.js" },
    dts: false,
    clean: false,
    sourcemap: false,
    minify: true,
    target: "es2020",
    outDir: "dist",
  },
]);
