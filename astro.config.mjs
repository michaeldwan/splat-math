import react from "@astrojs/react";
import cloudflare from "@astrojs/cloudflare";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://splatmath.com",
  adapter: cloudflare({ prerenderEnvironment: "node", imageService: "passthrough" }),
  session: false,
  integrations: [react()],
});
