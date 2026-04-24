/**
 * JSON 输出模块
 *
 * 负责生成 Synology API 兼容的 JSON 响应
 */

import { Config } from "../config/Config";
import { DeviceList } from "../device/DeviceList";
import { PackageInfo } from "../package/Package";
import { UrlFixer } from "./UrlFixer";

export class JsonOutput {
  private urlFixer: UrlFixer;
  
  constructor(private config: Config) {
    this.urlFixer = new UrlFixer(config.baseUrl, config.baseUrlRelative, config.externalStorageUrl);
  }

  /**
   * 生成包列表响应
   * 
   * 根据文档规范，响应格式应符合 Synology Package Center API 规范
   * 缓存时间：600秒（10分钟）
   */
  packagesResponse(
    packages: PackageInfo[],
    params: {
      unique?: string | null;
      arch?: string | null;
      major?: string | null;
      minor?: string | null;
      build?: string | null;
      language?: string | null;
      channel?: string;
    }
  ): Response {
    const allPackages = packages.map((pkg) => this.formatPackage(pkg, params));

    const response = {
      packages: allPackages,
      keyrings: [] as string[],
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=600",
      },
    });
  }

  /**
   * 生成信息响应
   */
  infoResponse(arch: string, deviceList: DeviceList): Response {
    const devices = deviceList.getDevicesByArch(arch);

    const response = {
      success: true,
      data: {
        arch,
        models: devices.map((d) => d.name),
        family: deviceList.getFamily(arch),
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  /**
   * 格式化包信息
   * 
   * 根据文档规范，字段命名应符合 Synology Package Center API 规范：
   * - package: 包名
   * - dname: 显示名称
   * - desc: 描述
   * - link: 下载链接
   * - qinst: 是否可以静默安装
   * - qupgrade: 是否可以静默升级
   * - qstart: 是否可以静默启动
   */
  private formatPackage(
    pkg: PackageInfo,
    params: {
      arch?: string | null;
      build?: string | null;
    }
  ): Record<string, unknown> {
    const meta = pkg.metadata;
    const packagesPath = this.config.paths.packages;

    const filename = pkg.key.replace(packagesPath, "");
    const spkUrl = this.urlFixer.fixDownloadUrl(filename, params.arch, params.build);
    const thumbnailUrl = meta.thumbnail_url?.[0] || "";

    const entry: Record<string, unknown> = {
      package: meta.package || pkg.filename,
      version: meta.version,
      dname: meta.displayname || meta.package || pkg.filename,
      desc: meta.description || "",

      link: spkUrl,
      thumbnail: [this.urlFixer.fixIconUrl(thumbnailUrl)],
      arch: meta.arch || [],

      qinst: meta.qinst !== false,
      qupgrade: meta.qupgrade !== false,
      qstart: meta.qstart !== false,

      deppkgs: null,
      conflictpkgs: null,
      download_count: 0,
    };

    if (meta.checksum) {
      entry.md5 = meta.checksum;
    }

    if (meta.firmware) {
      entry.firmware = meta.firmware;
    }

    if (meta.helpurl) {
      entry.helpurl = meta.helpurl;
    }

    return entry;
  }
}
