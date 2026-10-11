import { defineConfig } from "cf/config";

export default defineConfig(({ isPreview }) => ({
  worker: {
    name: "splat-math",
    compatibilityDate: "2026-10-01",
    domains: isPreview ? [] : ["splatmath.com"],
    workersDev: true,
    assets: {
      notFoundHandling: "404-page",
    },
    observability: {
      enabled: true,
      logs: {
        enabled: true,
        headSamplingRate: 1,
      },
      traces: {
        enabled: true,
        headSamplingRate: 0.1,
      },
    },
  },
}));
