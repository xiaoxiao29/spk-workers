/**
 * 删除处理器
 *
 * 处理删除包请求，清理 R2、D1/KV 中的相关数据
 */

import { AbstractHandler } from "./AbstractHandler";
import { Config } from "../config/Config";
import { StorageManager } from "../package/StorageManager";
import { D1Database } from "../db/D1Database";

/**
 * 删除响应
 */
interface DeleteResponse {
  success: boolean;
  message: string;
}

/**
 * 删除处理器
 */
export class DeleteHandler extends AbstractHandler {
  private storageManager: StorageManager;
  private d1Database: D1Database;

  constructor(private config: Config) {
    super();
    this.storageManager = new StorageManager(this.config.storageBackend);
    this.d1Database = new D1Database();
  }

  /**
   * 检查是否能处理该请求
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    return (
      url.pathname.startsWith("/api/packages/") && request.method === "DELETE"
    ) || (
      url.pathname === "/api/admin/recreate-tables" && request.method === "POST"
    );
  }

  /**
   * 处理删除请求
   *
   * 流程：
   * 1. 解析包名
   * 2. 验证 API Key
   * 3. 查询包信息
   * 4. 删除 R2 中的 SPK 文件
   * 5. 删除 R2 中的缩略图（如果有）
   * 6. 删除存储后端中的元数据
   */
  async handle(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 处理表重建请求
    if (url.pathname === "/api/admin/recreate-tables" && request.method === "POST") {
      const apiKey = request.headers.get("X-API-Key");
      if (!await this.validateApiKey(apiKey, env)) {
        return this.json(
          { error: { code: "UNAUTHORIZED", message: "Invalid API Key" } },
          { status: 401 }
        );
      }

      try {
        console.log("Starting to recreate tables...");
        
        // 重建表结构
        await this.d1Database.initialize(env, true);
        
        console.log("Tables recreated successfully");
        return this.json({ 
          success: true, 
          message: "Tables recreated successfully. All data has been cleared."
        });
      } catch (e) {
        console.error("Recreate tables failed:", e);
        return this.json(
          { error: { code: "RECREATE_FAILED", message: String(e) } },
          { status: 500 }
        );
      }
    }

    // 处理包删除请求
    const packageName = url.pathname.replace("/api/packages/", "");

    if (!packageName) {
      return this.json(
        { error: { code: "INVALID_REQUEST", message: "Package name is required" } },
        { status: 400 }
      );
    }

    const apiKey = request.headers.get("X-API-Key");
    if (!await this.validateApiKey(apiKey, env)) {
      return this.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid API Key" } },
        { status: 401 }
      );
    }

    try {
      const pkg = await this.storageManager.getPackage(env, packageName);
      if (!pkg) {
        return this.json(
          { error: { code: "PACKAGE_NOT_FOUND", message: `Package '${packageName}' not found` } },
          { status: 404 }
        );
      }

      const deletePromises: Promise<void>[] = [];

      if (pkg.key) {
        deletePromises.push(
          env.SPKS_BUCKET.delete(pkg.key)
            .then(() => { console.log(`Deleted R2 file: ${pkg.key}`); })
            .catch((e) => { console.warn(`Failed to delete SPK ${pkg.key}:`, e); })
        );
      }

      const r2KeysToDelete = this.collectR2ResourceKeys(pkg.metadata);
      for (const key of r2KeysToDelete) {
        deletePromises.push(
          env.SPKS_BUCKET.delete(key)
            .then(() => { console.log(`Deleted R2 resource: ${key}`); })
            .catch((e) => { console.warn(`Failed to delete resource ${key}:`, e); })
        );
      }

      deletePromises.push(this.storageManager.deletePackage(env, packageName));

      await Promise.all(deletePromises);

      const response: DeleteResponse = {
        success: true,
        message: "Package deleted successfully",
      };

      return this.json(response);
    } catch (e) {
      console.error("Delete failed:", e);
      return this.json(
        { error: { code: "DELETE_FAILED", message: String(e) } },
        { status: 500 }
      );
    }
  }

  private collectR2ResourceKeys(metadata: { thumbnail_url?: string[]; snapshot_url?: string[] }): string[] {
    const keys: string[] = [];
    const r2Prefixes = ["icons/", "snapshots/"];

    for (const url of metadata.thumbnail_url || []) {
      if (url && r2Prefixes.some((p) => url.startsWith(p))) {
        keys.push(url);
      }
    }

    for (const url of metadata.snapshot_url || []) {
      if (url && r2Prefixes.some((p) => url.startsWith(p))) {
        keys.push(url);
      }
    }

    return keys;
  }
}
