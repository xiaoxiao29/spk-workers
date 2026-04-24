/**
 * 上传处理器
 *
 * 处理 SPK 包上传请求
 */

import { AbstractHandler } from "./AbstractHandler";
import { Config } from "../config/Config";
import { PackageMetadata, normalizeArchs } from "../package/Package";
import { StorageManager } from "../package/StorageManager";
import { UrlFixer } from "../output/UrlFixer";

/**
 * 上传响应
 */
interface UploadResponse {
  success: boolean;
  filename?: string;
  package?: string;
  version?: string;
  arch?: string[];
  thumbnail_url?: string;
  message: string;
}

/**
 * 上传错误响应
 */
interface UploadError {
  error: {
    code: string;
    message: string;
  };
}

/**
 * 上传处理器
 */
export class UploadHandler extends AbstractHandler {
  private readonly MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
  private readonly PACKAGES_PREFIX = "packages/";
  private storageManager: StorageManager;
  private urlFixer: UrlFixer;

  constructor(private config: Config) {
    super();
    this.storageManager = new StorageManager(this.config.storageBackend);
    this.urlFixer = new UrlFixer(this.config.baseUrl, this.config.baseUrlRelative, this.config.externalStorageUrl);
  }

  /**
   * 检查是否能处理该请求
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname === "/api/upload" && request.method === "POST";
  }

  /**
   * 处理上传请求
   *
   * 流程：
   * 1. 验证 API Key
   * 2. 解析表单数据
   * 3. 验证文件大小和类型
   * 4. 检查是否覆盖已存在的包
   * 5. 上传 SPK 文件到 R2
   * 6. 处理缩略图（如果有）
   * 7. 保存包元数据到存储后端
   */
  async handle(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
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
    } catch (_e) {
      return this.json(
        { error: { code: "INVALID_FORM_DATA", message: "Failed to parse form data" } },
        { status: 400 }
      );
    }

    const file = formData.get("spk") as unknown as File | null;
    if (!file) {
      return this.json(
        { error: { code: "NO_FILE", message: "No SPK file provided" } },
        { status: 400 }
      );
    }

    const validationError = this.validateFile(file);
    if (validationError) {
      return this.json(validationError, { status: 400 });
    }

    const overwrite = formData.get("overwrite") === "true";
    const r2Key = `${this.PACKAGES_PREFIX}${file.name}`;

    if (!overwrite) {
      const existing = await env.SPKS_BUCKET.head(r2Key);
      if (existing) {
        return this.json(
          {
            error: {
              code: "PACKAGE_EXISTS",
              message: "Package already exists. Set overwrite=true to replace.",
            },
          },
          { status: 409 }
        );
      }
    }

    try {
      const metadataJson = formData.get("metadata") as string | null;
      let metadata: Partial<PackageMetadata> = {};
      if (metadataJson) {
        try {
          const raw: Record<string, unknown> = JSON.parse(metadataJson);

          metadata = {
            package: raw.package as string,
            version: raw.version as string,
            displayname: (raw.displayname || raw.package) as string,
            description: raw.description as string,
            maintainer: raw.maintainer as string,
            maintainer_url: raw.maintainer_url as string,
            distributor: raw.distributor as string,
            distributor_url: raw.distributor_url as string,
            helpurl: raw.helpurl as string,
            arch: normalizeArchs(raw.arch as string | string[]),
            firmware: (raw.firmware || raw.os_min_ver) as string,
            beta: raw.beta as boolean,
            checksum: raw.checksum as string,
            qinst: raw.qinst as boolean,
            qupgrade: raw.qupgrade as boolean,
            qstart: raw.qstart as boolean,
            thumbnail_url: (raw.thumbnail_url || raw._thumbnail_url) as string[],
          };
        } catch (e) {
          console.error("Failed to parse metadata:", e);
        }
      }

      const asciiFilename = file.name.replace(/[^\x21-\x7E]/g, "_").replace(/"/g, '\\"');
      const contentDisposition = `attachment; filename="${asciiFilename}"; filename*=UTF-8''${encodeURIComponent(file.name)}`;

      await env.SPKS_BUCKET.put(r2Key, file.stream(), {
        httpMetadata: {
          contentType: "application/octet-stream",
          contentDisposition: contentDisposition,
        },
      });

      const head = await env.SPKS_BUCKET.head(r2Key);
      metadata.size = head?.size || file.size;

      const thumbnailFile = formData.get("thumbnail") as unknown as File | null;
      if (thumbnailFile && thumbnailFile.size > 0) {
        const displayName = (metadata.displayname || metadata.package || r2Key.replace(this.PACKAGES_PREFIX, "").replace(".spk", "")).replace(/[^a-zA-Z0-9_-]/g, "_");
        const iconKey = `icons/${displayName}.png`;

        await env.SPKS_BUCKET.put(iconKey, thumbnailFile.stream(), {
          httpMetadata: {
            contentType: "image/png",
          },
        });

        metadata.thumbnail_url = [iconKey];
        console.log(`Thumbnail uploaded to ${iconKey}`);
      } else {
        const iconUrl = formData.get("icon_url") as string | null;
        if (iconUrl) {
          metadata.thumbnail_url = [iconUrl];
          console.log(`Using pre-uploaded icon: ${iconUrl}`);
        } else {
          console.log("No thumbnail provided in upload");
        }
      }

      const packageName = metadata.package || r2Key.replace(this.PACKAGES_PREFIX, "").replace(".spk", "");
      await this.storageManager.savePackage(env, packageName, r2Key, metadata);

      const response: UploadResponse = {
        success: true,
        filename: file.name,
        package: metadata.package || packageName,
        version: metadata.version || "unknown",
        arch: metadata.arch || [],
        message: "Package uploaded and indexed",
      };

      // Include thumbnail URL if available
      if (metadata.thumbnail_url && metadata.thumbnail_url.length > 0) {
        response.thumbnail_url = this.urlFixer.fixThumbnailUrl(metadata.thumbnail_url[0], metadata.package || packageName);
      }

      return this.json(response);
    } catch (e) {
      console.error("Upload failed:", e);
      return this.json(
        { error: { code: "UPLOAD_FAILED", message: String(e) } },
        { status: 500 }
      );
    }
  }

  /**
   * 验证上传文件
   *
   * 检查文件大小和类型是否符合要求
   */
  private validateFile(file: File): UploadError | null {
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        error: {
          code: "FILE_TOO_LARGE",
          message: `File size exceeds ${this.MAX_FILE_SIZE / 1024 / 1024}MB limit`,
        },
      };
    }

    if (!file.name.toLowerCase().endsWith(".spk")) {
      return {
        error: {
          code: "INVALID_FILE_TYPE",
          message: "Only .spk files are allowed",
        },
      };
    }

    return null;
  }
}
