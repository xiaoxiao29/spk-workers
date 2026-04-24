/**
 * 浏览器页面处理器
 *
 * 处理 Web 页面请求，返回 HTML
 */

import { AbstractHandler } from "./AbstractHandler";
import { Config } from "../config/Config";
import { DeviceList } from "../device/DeviceList";
import { HtmlOutput } from "../output/HtmlOutput";
import { StorageManager } from "../package/StorageManager";
import { UrlFixer } from "../output/UrlFixer";

/**
 * 浏览器页面处理器
 */
export class BrowserHandler extends AbstractHandler {
  private htmlOutput: HtmlOutput;
  private storageManager: StorageManager;
  private urlFixer: UrlFixer;

  constructor(
    private config: Config,
    private deviceList: DeviceList,
    private env: Env
  ) {
    super();
    this.htmlOutput = new HtmlOutput(
      this.config.baseUrl,
      this.config.baseUrlRelative,
      this.config.site.name,
      this.config.site.theme
    );
    this.storageManager = new StorageManager(this.config.storageBackend);
    this.urlFixer = new UrlFixer(this.config.baseUrl, this.config.baseUrlRelative, this.config.externalStorageUrl);
  }

  /**
   * 检查是否能处理该请求
   *
   * 排除静态资源文件和上传页面，处理其他所有 HTML 请求
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    if (url.pathname === "/upload") return false;

    const staticExt = [".js", ".css", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".webp", ".woff", ".woff2"];
    if (staticExt.some(ext => url.pathname.endsWith(ext))) return false;

    return (
      request.headers.get("Accept")?.includes("text/html") ||
      url.pathname === "/" ||
      url.pathname === "/index.html" ||
      url.pathname.startsWith("/?") ||
      url.pathname.startsWith("/package/")
    );
  }

  /**
   * 处理请求
   */
  async handle(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // 路由分发
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return this.handleIndex(url);
    }

    if (url.pathname.startsWith("/?arch=")) {
      return this.handlePackageList(url);
    }

    if (url.pathname.startsWith("/package/")) {
      return this.handlePackageDetail(url);
    }

    // 默认显示设备列表
    return this.handleIndex(url);
  }

  /**
   * 处理首页/设备列表
   */
  private handleIndex(url: URL): Response | Promise<Response> {
    const arch = url.searchParams.get("arch");

    // 如果指定了架构，显示包列表
    if (arch) {
      return this.renderPackageList(arch);
    }

    // 否则显示设备列表
    return this.renderModelList();
  }

  /**
   * 处理包列表页面
   */
  private handlePackageList(url: URL): Response | Promise<Response> {
    const arch = url.searchParams.get("arch");
    if (!arch) {
      return this.renderModelList();
    }
    return this.renderPackageList(arch);
  }

  /**
   * 处理包详情页面
   */
  private handlePackageDetail(url: URL): Response | Promise<Response> {
    const name = url.pathname.replace("/package/", "");
    return this.renderPackageDetail(name);
  }

  /**
   * 渲染设备列表页面
   */
  private renderModelList(): Response {
    const families = this.deviceList.getDevicesByFamily();
    const familyList: { family: string; devices: { arch: string; name: string }[] }[] = [];

    for (const [family, devices] of families) {
      familyList.push({ family, devices });
    }

    return this.htmlOutput.response("html_modellist", {
      families: familyList,
    });
  }

  /**
   * 渲染包列表页面（始终从 StorageManager 查询）
   */
  private async renderPackageList(arch: string): Promise<Response> {
    const packages = await this.storageManager.getPackagesByArch(this.env, arch, this.config.baseUrl);

    const family = this.deviceList.getFamily(arch);

    const packageData = packages.map((pkg) => ({
      package: pkg.metadata.package || pkg.filename,
      displayname: pkg.metadata.displayname || pkg.metadata.package || pkg.filename,
      version: pkg.metadata.version,
      description: pkg.metadata.description || "",
      arch: pkg.metadata.arch,
      beta: pkg.metadata.beta,
      thumbnail: this.urlFixer.fixThumbnailUrl(pkg.metadata.thumbnail_url?.[0] || "", pkg.metadata.package || pkg.filename),
    }));

    const response = this.htmlOutput.response("html_packagelist", {
      arch,
      family,
      packages: packageData,
      packageCount: packages.length,
    });

    return new Response(response.body, {
      ...response,
      headers: {
        ...response.headers,
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  /**
   * 渲染包详情页面（按需从 KV 读取）
   */
  private async renderPackageDetail(name: string): Promise<Response> {
    const pkg = await this.storageManager.getPackage(this.env, name);

    if (!pkg) {
      return this.htmlOutput.response("html_packagelist", {
        error: `Package not found: ${name}`,
      });
    }

    const meta = pkg.metadata;
    const spkUrl = this.urlFixer.fixDownloadUrl(pkg.filename);

    return this.htmlOutput.response("html_package_detail", {
      package: meta.package || pkg.filename,
      displayname: meta.displayname || meta.package || pkg.filename,
      version: meta.version,
      description: meta.description || "",
      maintainer: meta.maintainer,
      maintainer_url: meta.maintainer_url,
      arch: meta.arch,
      beta: meta.beta,
      firmware: meta.firmware,
      thumbnail: this.urlFixer.fixThumbnailUrl(meta.thumbnail_url?.[0] || "", meta.package || pkg.filename),
      spk_url: spkUrl,
      filename: pkg.filename,
      size: this.formatSize(pkg.size),
      checksum: meta.checksum || "",
    });
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB"];
    const k = 1024;
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + units[i];
  }
}
