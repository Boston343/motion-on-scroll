import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  minify: true,
  target: "esnext",
  outDir: "dist",
  onSuccess: "pnpx lightningcss-cli src/css/mos.css -o dist/mos.css --minify",
  // banner: {
  //   js: "#!/usr/bin/env node",
  // },
});
