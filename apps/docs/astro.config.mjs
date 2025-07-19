// @ts-check
import starlight from "@astrojs/starlight";
import GeistVariable from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2";
import GeistMonoVariable from "@fontsource-variable/geist-mono/files/geist-mono-latin-wght-normal.woff2";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// https://astro.build/config
export default defineConfig({
  site: "https://motion-on-scroll.boston343.com",
  integrations: [
    starlight({
      title: "Motion on Scroll",
      expressiveCode: {
        // themes: ["catppuccin-macchiato"],
      },
      customCss: [
        // Path to your Tailwind base styles:
        "./src/styles/global.css",
        // fonts
        "@fontsource-variable/geist",
        "@fontsource-variable/geist-mono",
      ],
      social: [
        { icon: "github", label: "GitHub", href: "https://github.com/Boston343/motion-on-scroll" },
      ],
      sidebar: [
        {
          label: "Getting Started",
          autogenerate: { directory: "getting-started" },
          // items: [
          //   // Each item here is one entry in the navigation menu.
          //   { label: "Example Guide", slug: "guides/example" },
          // ],
        },
        {
          label: "Reference",
          autogenerate: { directory: "reference" },
        },
      ],
      head: [
        {
          tag: "link",
          attrs: {
            rel: "preload",
            href: GeistMonoVariable,
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
        },
        {
          tag: "link",
          attrs: {
            rel: "preload",
            href: GeistVariable,
            as: "font",
            type: "font/woff2",
            crossorigin: "anonymous",
          },
        },
      ],
      plugins: [starlightLlmsTxt()],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
