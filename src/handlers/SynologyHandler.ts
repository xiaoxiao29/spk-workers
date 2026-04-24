/**
 * Synology API 处理器
 *
 * 处理 Synology Package Center 的 API 请求
 */

import { AbstractHandler } from "./AbstractHandler";
import { Config } from "../config/Config";
import { DeviceList } from "../device/DeviceList";
import { JsonOutput } from "../output/JsonOutput";
import { StorageManager } from "../package/StorageManager";

export class SynologyHandler extends AbstractHandler {
  private storageManager: StorageManager;

  constructor(
    private config: Config,
    private deviceList: DeviceList,
    private env: Env
  ) {
    super();
    this.storageManager = new StorageManager(this.config.storageBackend);
  }

  /**
   * 检查是否能处理该请求
   *
   * 处理 Synology Package Center 的 API 端点：
   * - / - 包列表（群晖客户端）
   * - /api/info - 设备信息
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    if (url.pathname === "/api/info") {
      return true;
    }
    if (url.pathname === "/") {
      const detection = this.detectSynologyClient(request, url);
      return detection.matched;
    }
    return false;
  }

  /**
   * 处理 Synology API 请求
   *
   * 根据路径分发到对应的处理方法
   */
  async handle(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const startTime = Date.now();
    const requestId = crypto.randomUUID().slice(0, 8);
    const clientIp = request.headers.get("CF-Connecting-IP") || request.headers.get("X-Forwarded-For") || "unknown";
    const userAgent = request.headers.get("User-Agent") || "unknown";
    const accept = request.headers.get("Accept") || "none";

    console.log(`
┌─────────────────────────────────────────────────────────────
│ [Synology API] 请求 #${requestId}
├─────────────────────────────────────────────────────────────
│ 路径:    ${url.pathname}${url.search}
│ 方法:   ${request.method}
│ IP:     ${clientIp}
│ UA:     ${userAgent.slice(0, 50)}${userAgent.length > 50 ? "..." : ""}
│ Accept: ${accept.slice(0, 50)}${accept.length > 50 ? "..." : ""}`);

    let response: Response;

    // API 路由分发
    if (url.pathname === "/") {
      const detection = this.detectSynologyClient(request, url);
      if (detection.matched) {
        console.log(`│ 识别:   ${detection.reason} ✅`);
        console.log("├─────────────────────────────────────────────────────────────");
        response = await this.handlePackages(url, request, requestId);
      } else {
        console.log(`│ 识别:   ${detection.reason} ❌ → 跳過`);
        response = this.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
      }
    } else if (url.pathname === "/api/info") {
      console.log(`│ 识别:   /api/info ✅`);
      console.log("├─────────────────────────────────────────────────────────────");
      response = this.handleInfo(url, requestId);
    } else {
      console.log(`│ 识别:   unknown path ❌`);
      response = this.json({ error: { code: "NOT_FOUND" } }, { status: 404 });
    }

    const duration = Date.now() - startTime;
    const statusEmoji = response.status < 300 ? "✅" : response.status < 400 ? "⚠️" : "❌";
    console.log(`
├─────────────────────────────────────────────────────────────
│ 状态:   ${response.status} ${statusEmoji}
│ 耗时:   ${duration}ms
│ 请求ID: ${requestId}
└─────────────────────────────────────────────────────────────`);

    return response;
  }

  /**
   * 处理包列表请求
   *
   * 根据文档规范验证必填参数：
   * - build: 必填，DSM 构建号
   * - arch: 必填，架构代码
   * - language: 必填，语言代码
   */
  private async handlePackages(url: URL, _request: Request, requestId: string): Promise<Response> {
    const params = url.searchParams;

    // 解析查询参数
    const unique = params.get("unique");
    const arch = params.get("arch");
    const major = params.get("major");
    const minor = params.get("minor");
    const build = params.get("build");
    const language = params.get("language");
    const channel = params.get("package_update_channel") || "stable";

    console.log(`
├─────────────────────────────────────────────────────────────
│ [包列表 #${requestId}]
│ 参数:
│   unique:  ${unique || "(未提供)"}
│   arch:    ${arch || "(未提供)"}
│   major:   ${major || "(未提供)"}
│   minor:   ${minor || "(未提供)"}
│   build:   ${build || "(未提供)"}
│   language: ${language || "(未提供)"}
│   channel: ${channel}`);

    // 兼容部分 DSM 探测请求：build/language 缺失时使用默认值。
    // 某些 DSM 在校验仓库地址时不会传 arch，此时返回空包列表（200）避免被判定为无效位置。
    if (!arch) {
      console.log(`
│ ⚠️  未提供 arch → 返回空包列表用于探测
└─────────────────────────────────────────────────────────────`);
      const jsonOutput = new JsonOutput(this.config);
      return jsonOutput.packagesResponse([], {
        unique,
        arch: "unknown",
        major,
        minor,
        build: build || "0",
        language: language || "enu",
        channel,
      });
    }

    console.log(`
│ ✅ 参数验证通过 → 查询 ${arch} 的包列表`);

    const queryStart = Date.now();
    const packages = await this.storageManager.getPackagesByArch(this.env, arch, this.config.baseUrl);
    const queryDuration = Date.now() - queryStart;

    console.log(`
│ 📦 找到 ${packages.length} 个包
│ ⏱️  查询耗时: ${queryDuration}ms
└─────────────────────────────────────────────────────────────`);

    const jsonOutput = new JsonOutput(this.config);
    return jsonOutput.packagesResponse(packages, {
      unique,
      arch,
      major,
      minor,
      build: build || "0",
      language: language || "enu",
      channel,
    });
  }

  /**
   * 基于请求头识别是否来自群晖套件中心/系统服务
   */
  private detectSynologyClient(request: Request, url: URL): { matched: boolean; reason: string } {
    const userAgent = (request.headers.get("User-Agent") || "").toLowerCase();

    if (userAgent.includes("synology") || userAgent.includes("synopkg")) {
      return { matched: true, reason: "user-agent" };
    }

    if (request.headers.has("x-syno-token")) {
      return { matched: true, reason: "x-syno-token" };
    }
    if (request.headers.has("x-syno-signature")) {
      return { matched: true, reason: "x-syno-signature" };
    }
    if (request.headers.has("x-syno-request-id")) {
      return { matched: true, reason: "x-syno-request-id" };
    }

    const accept = (request.headers.get("Accept") || "").toLowerCase();
    if (accept.includes("application/json") && !accept.includes("text/html")) {
      return { matched: true, reason: "accept-json" };
    }
    if (!accept) {
      return { matched: true, reason: "no-accept-header" };
    }

    return { matched: false, reason: "none" };
  }

  /**
   * 处理信息请求
   */
  private handleInfo(url: URL, requestId: string): Response {
    const params = url.searchParams;
    const arch = params.get("arch");

    console.log(`
├─────────────────────────────────────────────────────────────
│ [设备信息 #${requestId}]
│ 参数:
│   arch: ${arch || "(未提供)"}`);

    if (!arch) {
      console.log(`│ ❌ 缺少 arch 参数
└─────────────────────────────────────────────────────────────`);
      return this.json({ error: { code: "INVALID_PARAMS" } }, { status: 400 });
    }

    console.log(`│ ✅ 查询设备信息: ${arch}`);

    const jsonOutput = new JsonOutput(this.config);
    const response = jsonOutput.infoResponse(arch, this.deviceList);

    console.log(`│ ✅ 返回设备信息
└─────────────────────────────────────────────────────────────`);

    return response;
  }
}
