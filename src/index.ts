/**
 * SPK Workers 入口文件
 *
 * Cloudflare Worker 主模块，负责初始化和请求处理
 */

import { Config } from "./config/Config";
import { DeviceList } from "./device/DeviceList";
import { Router } from "./handlers/Router";
import { SynologyHandler } from "./handlers/SynologyHandler";
import { BrowserHandler } from "./handlers/BrowserHandler";
import { UploadHandler } from "./handlers/UploadHandler";
import { IconHandler } from "./handlers/IconHandler";
import { UploadPageHandler } from "./handlers/UploadPageHandler";
import { DownloadHandler } from "./handlers/DownloadHandler";
import { DeleteHandler } from "./handlers/DeleteHandler";
import { AssetsHandler } from "./handlers/AssetsHandler";
import { NotFoundHandler } from "./handlers/NotFoundHandler";
import { CacheKeyBuilder, CACHE_TTL } from "./utils/CacheKeyBuilder";

/**
 * 处理结果
 */
interface HandleResult {
  config: Config;
  deviceList: DeviceList;
}

/**
 * 性能指标
 */
interface PerformanceMetrics {
  initTime: number;
  handleTime: number;
  totalTime: number;
  cacheHit: boolean;
}

/**
 * 全局缓存 - 设备配置
 */
let cachedDeviceList: DeviceList | null = null;
let lastDeviceListCacheTime = 0;
const DEVICE_LIST_CACHE_TTL = 3600000; // 1小时

/**
 * 全局缓存 - Router 实例
 */
let routerInstance: Router | null = null;
let lastRouterConfig: { baseUrl: string; basePath: string } | null = null;

/**
 * 初始化 Workers（带缓存优化）
 */
async function init(env: Env, request: Request): Promise<HandleResult> {
  const requestUrl = new URL(request.url);
  const normalizedHost = requestUrl.host.replace(/\.$/, '');
  const baseUrl = `${requestUrl.protocol}//${normalizedHost}`;
  const basePath = getBasePath(requestUrl.pathname);

  const config = new Config(env, baseUrl, basePath);

  const now = Date.now();
  
  if (cachedDeviceList && (now - lastDeviceListCacheTime) < DEVICE_LIST_CACHE_TTL) {
    return { config, deviceList: cachedDeviceList };
  }

  const cacheKey = CacheKeyBuilder.forDeviceConfig(config.paths.models);
  let modelsContent: string | null = null;

  try {
    const cached = await env.SPKS_CACHE.get(cacheKey);
    if (cached) {
      modelsContent = cached;
    }
  } catch (e) {
    console.warn("Failed to read from KV cache:", e);
  }

  if (!modelsContent) {
    const obj = await env.SPKS_BUCKET.get(config.paths.models);
    if (!obj) {
      throw new Error(`Device configuration not found in R2: ${config.paths.models}`);
    }

    modelsContent = await obj.text();

    try {
      await env.SPKS_CACHE.put(cacheKey, modelsContent, {
        expirationTtl: CACHE_TTL.DEVICE_CONFIG
      });
    } catch (e) {
      console.warn("Failed to write to KV cache:", e);
    }
  }

  cachedDeviceList = new DeviceList(modelsContent);
  lastDeviceListCacheTime = now;

  return { config, deviceList: cachedDeviceList };
}

/**
 * 获取或创建 Router 实例（单例模式）
 */
function getRouter(config: Config, deviceList: DeviceList, env: Env): Router {
  if (routerInstance && 
      lastRouterConfig && 
      lastRouterConfig.baseUrl === config.baseUrl && 
      lastRouterConfig.basePath === config.basePath) {
    return routerInstance;
  }

  const router = new Router();
  router.addHandler(new AssetsHandler());
  router.addHandler(new IconHandler());
  router.addHandler(new SynologyHandler(config, deviceList, env));
  router.addHandler(new BrowserHandler(config, deviceList, env));
  router.addHandler(new UploadHandler(config));
  router.addHandler(new UploadPageHandler(config));
  router.addHandler(new DownloadHandler(config));
  router.addHandler(new DeleteHandler(config));
  router.addHandler(new NotFoundHandler());

  routerInstance = router;
  lastRouterConfig = { baseUrl: config.baseUrl, basePath: config.basePath };

  return router;
}

/**
 * 获取基础路径
 */
function getBasePath(pathname: string): string {
  if (pathname === "/" || pathname === "/index.html") return "./";
  if (pathname.startsWith("/?")) return "./";
  if (pathname.startsWith("/package/")) return "/";
  if (pathname.startsWith("/upload")) return "/";
  if (pathname === "/themes" || pathname.startsWith("/themes/")) return "/";
  if (pathname === "/public" || pathname.startsWith("/public/")) return "/";
  if (pathname === "/_assets" || pathname.startsWith("/_assets/")) return "/";
  if (pathname.startsWith("/api/")) return "/";
  const lastSlash = pathname.lastIndexOf("/");
  return lastSlash > 0 ? pathname.slice(0, lastSlash + 1) : "./";
}

/**
 * 主处理函数（带性能监控）
 */
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const startTime = Date.now();
    const metrics: PerformanceMetrics = {
      initTime: 0,
      handleTime: 0,
      totalTime: 0,
      cacheHit: false
    };

    try {
      const initStart = Date.now();
      const { config, deviceList } = await init(env, request);
      metrics.initTime = Date.now() - initStart;
      metrics.cacheHit = cachedDeviceList !== null;

      const handleStart = Date.now();
      const router = getRouter(config, deviceList, env);
      const response = await router.handle(request, env, ctx);
      metrics.handleTime = Date.now() - handleStart;

      metrics.totalTime = Date.now() - startTime;

      response.headers.set('X-Response-Time', `${metrics.totalTime}ms`);
      response.headers.set('X-Cache-Status', metrics.cacheHit ? 'HIT' : 'MISS');

      if (metrics.totalTime > 500) {
        console.warn('Slow request detected:', {
          path: new URL(request.url).pathname,
          method: request.method,
          metrics
        });
      }

      return response;
    } catch (e) {
      console.error("Worker error:", e);
      return Response.json(
        { error: { code: "INTERNAL_ERROR", message: String(e) } },
        { status: 500 }
      );
    }
  },
};
