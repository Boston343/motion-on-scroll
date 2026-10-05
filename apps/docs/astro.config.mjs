// @ts-check
import starlight from "@astrojs/starlight";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "astro/config";
import starlightLlmsTxt from "starlight-llms-txt";

// https://astro.build/config
export default defineConfig({
  site: "https://motion-on-scroll.pages.dev",
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
          items: [{ autogenerate: { directory: "getting-started" } }],
        },
        {
          label: "Reference",
          items: [{ autogenerate: { directory: "reference" } }],
        },
      ],
      plugins: [starlightLlmsTxt()],
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});
