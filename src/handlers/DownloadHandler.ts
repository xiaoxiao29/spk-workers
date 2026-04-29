/**
 * 下载处理器
 *
 * 处理 SPK 文件下载请求
 */

import { AbstractHandler } from "./AbstractHandler";
import { Config } from "../config/Config";

/**
 * R2 对象范围类型
 */
interface R2ObjectRange {
  offset: number;
  length?: number;
}

/**
 * 带范围信息的 R2 对象
 */
interface R2ObjectBodyWithRange extends R2ObjectBody {
  range?: R2ObjectRange;
}

/**
 * 下载处理器
 */
export class DownloadHandler extends AbstractHandler {
  constructor(private config: Config) {
    super();
  }

  /**
   * 检查是否能处理该请求
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname.startsWith("/packages/") && request.method === "GET";
  }

  /**
   * 处理下载请求
   *
   * 从 R2 存储中读取 SPK 文件并返回给客户端
   * 设置适当的 Content-Disposition 和缓存头
   * 记录下载统计信息到数据库
   */
  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\//, ""));
    const startTime = Date.now();

    if (!key || key === "packages/" || !this.isValidDownloadPath(key)) {
      console.error("[Download] ❌ 无效的文件路径");
      return this.json({ error: { code: "INVALID_PATH" } }, { status: 400 });
    }

    // If external storage URL is configured, redirect to it
    if (this.config.externalStorageUrl) {
      console.log(`[Download] 重定向到外部存储: ${this.config.externalStorageUrl}${key}`);
      return Response.redirect(`${this.config.externalStorageUrl}${key}`, 302);
    }

    console.log(`[Download] 正在从 R2 获取文件...`);
    const r2Start = Date.now();
    const object = await env.SPKS_BUCKET.get(key, {
      range: request.headers,
      onlyIf: request.headers,
    });
    const r2Duration = Date.now() - r2Start;

    if (!object) {
      console.error(`[Download] ❌ 文件不存在: ${key}`);
      console.log("[Download] ========== 下载请求结束 ==========\n");
      return this.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    console.log(`[Download] ✓ 文件已找到 (R2 查询耗时: ${r2Duration}ms)`);
    console.log(`[Download] 文件大小: ${(object.size / 1024 / 1024).toFixed(2)} MB`);

    // 记录下载统计（异步执行，不阻塞响应）
    ctx.waitUntil(this.recordDownload(env, key, request));

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("Content-Type", "application/octet-stream");
    
    const filename = key.split("/").pop() || "package.spk";
    const asciiFilename = filename.replace(/[^\x21-\x7E]/g, "_").replace(/"/g, '\\"');
    // Use RFC 5987 for non-ASCII filenames, with an ASCII fallback
    headers.set("Content-Disposition", `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    headers.set("Cache-Control", "public, max-age=86400");
    headers.set("Accept-Ranges", "bytes");
    
    if (object.etag) {
      headers.set("ETag", object.etag);
    }
    
    // Support 304 Not Modified
    if (!('body' in object) || !object.body) {
      console.log(`[Download] 304 Not Modified (文件未修改)`);
      console.log("[Download] ========== 下载请求结束 ==========\n");
      return new Response(null, {
        status: 304,
        headers,
      });
    }

    // Support Range Responses
    const range = (object as R2ObjectBodyWithRange).range;
    const status = range ? 206 : 200;
    
    if (range) {
      console.log(`[Download] 范围请求: bytes ${range.offset}-${range.offset + (range.length || 0) - 1}/${object.size}`);
      headers.set("Content-Range", `bytes ${range.offset}-${range.offset + (range.length || 0) - 1}/${object.size}`);
      headers.set("Content-Length", (range.length || 0).toString());
    } else {
      headers.set("Content-Length", object.size.toString());
    }

    const duration = Date.now() - startTime;
    console.log(`[Download] ✓ 开始传输文件 (HTTP ${status})`);
    console.log(`[Download] 处理耗时: ${duration}ms`);
    console.log("[Download] ========== 下载请求结束 ==========\n");

    return new Response(object.body, {
      status,
      headers,
    });
  }

  /**
   * 记录下载统计信息
   * 
   * 记录以下信息到数据库：
   * - 包名
   * - 客户端 IP 地址
   * - User-Agent
   * - 下载时间戳
   */
  private async recordDownload(env: Env, key: string, request: Request): Promise<void> {
    try {
      const filename = key.split("/").pop() || "";
      const packageName = filename.replace(".spk", "").split("-").slice(0, -2).join("-") || filename.replace(".spk", "");

      const rawIp = request.headers.get("CF-Connecting-IP") ||
                 request.headers.get("X-Forwarded-For")?.split(",")[0] ||
                 "unknown";

      const ip = this.anonymizeIp(rawIp.trim());
      const userAgent = request.headers.get("User-Agent") || "unknown";
      const timestamp = Date.now();

      await env.SPKS_DB.batch([
        env.SPKS_DB.prepare(
          "INSERT INTO downloads (package_id, arch, firmware_build, ip_address, user_agent, timestamp) VALUES (?, ?, ?, ?, ?, ?)"
        ).bind(packageName, null, null, ip, userAgent, timestamp),
        env.SPKS_DB.prepare(
          "UPDATE packages SET download_count = COALESCE(download_count, 0) + 1 WHERE id = ?"
        ).bind(packageName),
      ]);
    } catch (error) {
      console.error("[Download Stats] Failed to record:", error);
    }
  }

  private anonymizeIp(ip: string): string {
    if (ip === "unknown") return ip;
    const parts = ip.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
    }
    const colonParts = ip.split(":");
    if (colonParts.length >= 4) {
      return `${colonParts[0]}:${colonParts[1]}:${colonParts[2]}::x`;
    }
    return "unknown";
  }
}
