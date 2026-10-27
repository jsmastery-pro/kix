// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import wix from "@wix/astro";
import wixPages from "@wix/astro-pages";

import react from "@astrojs/react";
import wixHostingAdapter from "@wix/astro-wix-hosting-adapter";
import tailwindcss from "@tailwindcss/vite";

// https://astro.build/config
export default defineConfig({
  vite: { plugins: [tailwindcss()] },
  // PostHog (plan 06). Public by design; optional so a missing value turns analytics off, never the site.
  env: {
    schema: {
      PUBLIC_POSTHOG_PROJECT_TOKEN: envField.string({ context: "client", access: "public", optional: true }),
      PUBLIC_POSTHOG_HOST: envField.string({ context: "client", access: "public", optional: true }),
    },
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "Barlow Condensed",
      cssVariable: "--font-barlow",
      weights: [400, 500, 600, 700, 800, 900],
      styles: ["normal", "italic"],
      subsets: ["latin"],
    },
  ],
  integrations: [wix(), wixPages(), react()],
  security: { checkOrigin: false },
  adapter: wixHostingAdapter(),

  image: {
    domains: ["static.wixstatic.com"],
  },

  output: "server",
});
