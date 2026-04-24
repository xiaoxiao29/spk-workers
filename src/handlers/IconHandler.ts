/**
 * Icon 上传处理器
 *
 * 专门处理 package_icon.png 上传到 R2 icons 目录
 */

import { AbstractHandler } from "./AbstractHandler";

export class IconHandler extends AbstractHandler {
  private readonly ICONS_PREFIX = "icons/";

  /**
   * 检查是否能处理该请求
   *
   * 支持 POST（上传）和 GET（获取）两种方法
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname === "/api/icon" && (request.method === "POST" || request.method === "GET");
  }

  /**
   * 处理 Icon 请求
   *
   * - POST: 上传新的 icon 到 R2
   * - GET: 从 R2 获取 icon 并返回 base64 编码
   */
  async handle(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    if (request.method === "GET") {
      return this.handleGet(request, env);
    }

    const apiKey = request.headers.get("X-API-Key");
    if (!await this.validateApiKey(apiKey, env)) {
      return this.json(
        { error: { code: "UNAUTHORIZED", message: "Invalid API Key" } },
        { status: 401 }
      );
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (_err) {
      return this.json(
        { error: { code: "INVALID_FORM_DATA", message: "Failed to parse form data" } },
        { status: 400 }
      );
    }

    const iconFile = formData.get("icon") as unknown as File | null;
    if (!iconFile || iconFile.size === 0) {
      return this.json(
        { error: { code: "NO_ICON", message: "No icon file provided" } },
        { status: 400 }
      );
    }

    const displayName = formData.get("displayname") as string | null;
    if (!displayName) {
      return this.json(
        { error: { code: "NO_DISPLAYNAME", message: "No displayname provided" } },
        { status: 400 }
      );
    }

    const iconKey = `${this.ICONS_PREFIX}${displayName}.png`;

    try {
      await env.SPKS_BUCKET.put(iconKey, iconFile.stream(), {
        httpMetadata: {
          contentType: "image/png",
        },
      });

      console.log(`Icon uploaded to ${iconKey}`);

      return this.json({
        success: true,
        icon_url: `/${iconKey}`,
        message: "Icon uploaded successfully"
      });
    } catch (e) {
      console.error("Icon upload failed:", e);
      return this.json(
        { error: { code: "UPLOAD_FAILED", message: String(e) } },
        { status: 500 }
      );
    }
  }

  /**
   * 处理 GET 请求 - 获取 Icon
   *
   * 从 R2 读取 icon 文件并返回 base64 编码的 data URL
   */
  private async handleGet(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const name = url.searchParams.get("name");

    if (!name) {
      return this.json(
        { error: { code: "INVALID_REQUEST", message: "Missing 'name' parameter" } },
        { status: 400 }
      );
    }

    const iconKey = `${this.ICONS_PREFIX}${name}.png`;

    try {
      const obj = await env.SPKS_BUCKET.get(iconKey);
      if (!obj) {
        return this.json(
          { error: { code: "NOT_FOUND", message: "Icon not found" } },
          { status: 404 }
        );
      }

      const arrayBuffer = await obj.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      const mimeType = obj.httpMetadata?.contentType || "image/png";

      return this.json({
        success: true,
        icon_url: `data:${mimeType};base64,${base64}`
      });
    } catch (e) {
      console.error("Icon fetch failed:", e);
      return this.json(
        { error: { code: "FETCH_FAILED", message: String(e) } },
        { status: 500 }
      );
    }
  }
}
