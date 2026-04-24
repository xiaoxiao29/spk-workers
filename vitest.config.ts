/**
 * Vitest 测试配置
 *
 * 使用 @cloudflare/vitest-pool-workers 进行 Cloudflare Workers 测试
 * 支持单元测试和集成测试
 */

import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: {
        configPath: "./wrangler.toml",
      },
      miniflare: {
        r2Buckets: ["SPKS_BUCKET"],
        kvNamespaces: ["SPKS_CACHE"],
      },
    }),
  ],

  test: {
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    testTimeout: 30000,
    globals: true,
  },

  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
