/**
 * 静态资源处理器
 *
 * 处理非 Workers Assets 的静态资源请求
 * 支持 themes、public、icons 和 _assets 路径
 */

import { HandlerInterface } from "./AbstractHandler";
import { CacheKeyBuilder, CACHE_TTL } from "../utils/CacheKeyBuilder";

/**
 * 静态资源处理器
 *
 * 从 R2 存储中读取静态资源文件，并使用 KV 缓存提高性能
 */
export class AssetsHandler implements HandlerInterface {
  /**
   * 检查是否能处理该请求
   *
   * 支持以下路径：
   * - /_assets/* - 通用资源路径
   * - /themes/* - 主题文件
   * - /public/* - 公共资源
   * - /icons/* - 图标文件
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname.startsWith("/_assets/") || url.pathname.startsWith("/themes/") || url.pathname.startsWith("/public/") || url.pathname.startsWith("/icons/");
  }

  /**
   * 处理静态资源请求
   *
   * 流程：
   * 1. 检查 KV 缓存
   * 2. 如果缓存未命中，从 R2 读取文件
   * 3. 将文件内容缓存到 KV（TTL: 24小时）
   * 4. 返回文件内容
   */
  async handle(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    let assetPath = url.pathname.replace(/^\//, "");

    if (assetPath.startsWith("_assets/")) {
      assetPath = assetPath.replace(/^_assets\//, "");
    }

    try {
      const cache = caches.default;
      const cacheKey = new Request(url.toString());
      const cachedResponse = await cache.match(cacheKey);
      if (cachedResponse) {
        return cachedResponse;
      }

      const kvCacheKey = CacheKeyBuilder.forAsset(assetPath);
      const kvCached = await env.SPKS_CACHE.get(kvCacheKey);
      if (kvCached) {
        const response = new Response(kvCached, {
          headers: this.getHeaders(assetPath),
        });
        try {
          await cache.put(cacheKey, response.clone());
        } catch { /* Cache API may not be available in all environments */ }
        return response;
      }

      const obj = await env.SPKS_BUCKET.get(assetPath);
      if (!obj) {
        return new Response("Not Found", {
          status: 404,
          headers: { "Content-Type": this.getMimeType(assetPath) }
        });
      }

      const content = await obj.arrayBuffer();
      await env.SPKS_CACHE.put(kvCacheKey, content, { expirationTtl: CACHE_TTL.STATIC_ASSETS });

      const response = new Response(content, {
        headers: this.getHeaders(assetPath),
      });
      try {
        await cache.put(cacheKey, response.clone());
      } catch { /* Cache API may not be available in all environments */ }

      return response;
    } catch (e) {
      console.error("Assets error:", e);
      return new Response("Internal Error", { status: 500 });
    }
  }

  /**
   * 获取响应头
   *
   * 设置 Content-Type 和缓存控制头
   */
  private getHeaders(path: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": this.getMimeType(path),
      "Cache-Control": "public, max-age=86400",
    };
    return headers;
  }

  /**
   * 根据文件扩展名获取 MIME 类型
   */
  private getMimeType(path: string): string {
    const ext = path.split(".").pop()?.toLowerCase() || "";
    const mimeTypes: Record<string, string> = {
      css: "text/css",
      js: "application/javascript",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      gif: "image/gif",
      svg: "image/svg+xml",
      ico: "image/x-icon",
      webp: "image/webp",
    };
    return mimeTypes[ext] || "application/octet-stream";
  }
}
