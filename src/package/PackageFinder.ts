/**
 * 包查找器模块
 *
 * 负责从 KV 缓存加载 SPK 包信息
 */

import { Package, PackageInfo } from "./Package";
import { Config } from "../config/Config";

/**
 * 包查找结果
 */
export interface PackageFinderResult {
  packages: PackageInfo[];
  errors: string[];
}

/**
 * 包查找器类
 */
export class PackageFinder {
  constructor(
    private env: Env,
    private config: Config
  ) {}

  /**
   * 按架构扫描包（从 KV 索引获取）
   */
  async scanPackagesByArch(arch: string): Promise<PackageInfo[]> {
    return Package.getPackagesByArch(this.env, arch, this.config.baseUrl);
  }

  /**
   * 获取所有包名（从 KV 全量索引）
   */
  async getAllPackageNames(): Promise<string[]> {
    return Package.getAllPackageNames(this.env);
  }

  /**
   * 扫描所有 SPK 包（保留原有逻辑，用于兼容性）
   * @deprecated 建议使用 scanPackagesByArch 进行按需扫描
   */
  async scanPackages(): Promise<PackageFinderResult> {
    const packages: PackageInfo[] = [];
    const errors: string[] = [];
    const prefix = this.config.packagesPrefix;
    const fileMask = this.config.packages.file_mask;

    try {
      const listed = await this.env.SPKS_BUCKET.list({
        prefix,
        limit: 1000,
      });

      for (const obj of listed.objects) {
        if (!this.matchesMask(obj.key, fileMask)) {
          continue;
        }

        const packageName = this.getPackageName(obj.key);
        const pkg = await Package.fromCache(this.env, packageName);

        if (pkg) {
          pkg.size = obj.size;
          pkg.lastModified = obj.uploaded?.toISOString() || new Date().toISOString();
          pkg.filename = obj.key.replace(prefix, "");
          pkg.metadata.spk_url = `${this.config.baseUrl}/packages/${pkg.filename}`;
          packages.push(pkg);
        } else {
          const basicPkg = this.createBasicPackageInfo(obj);
          packages.push(basicPkg);
        }
      }
    } catch (e) {
      errors.push(`Failed to list packages: ${e}`);
    }

    return { packages, errors };
  }

  /**
   * 获取单个包信息
   */
  async getPackage(key: string): Promise<PackageInfo | null> {
    const packageName = this.getPackageName(key);
    const pkg = await Package.fromCache(this.env, packageName);

    if (pkg) {
      try {
        const obj = await this.env.SPKS_BUCKET.head(key);
        pkg.size = obj?.size || 0;
        pkg.lastModified = obj?.uploaded?.toISOString() || new Date().toISOString();
      } catch {
        // ignore
      }
      pkg.filename = key.replace(this.config.packagesPrefix, "");
      pkg.metadata.spk_url = `${this.config.baseUrl}/packages/${pkg.filename}`;
      return pkg;
    }

    try {
      const obj = await this.env.SPKS_BUCKET.head(key);
      if (!obj) return null;
      return this.createBasicPackageInfo(obj);
    } catch (e) {
      console.error(`Failed to get package ${key}:`, e);
      return null;
    }
  }

  /**
   * 从包文件名提取包名
   */
  private getPackageName(r2Key: string): string {
    const filename = r2Key.replace(this.config.packagesPrefix, "");
    const nameWithoutExt = filename.replace(".spk", "");
    return nameWithoutExt.split("-").slice(0, -1).join("-") || nameWithoutExt;
  }

  /**
   * 创建基本的包信息（当缓存不存在时）
   */
  private createBasicPackageInfo(obj: R2Object): PackageInfo {
    const filename = obj.key.replace(this.config.packagesPrefix, "");
    const packageName = this.getPackageName(obj.key);
    const spkUrl = `${this.config.baseUrl}/packages/${filename}`;

    return {
      key: obj.key,
      filename,
      size: obj.size,
      lastModified: obj.uploaded?.toISOString() || new Date().toISOString(),
      metadata: {
        package: packageName,
        version: "unknown",
        displayname: packageName,
        description: "",
        arch: [],
        thumbnail: [],
        thumbnail_url: [],
        snapshot: [],
        snapshot_url: [],
        spk: obj.key,
        spk_url: spkUrl,
      },
    };
  }

  /**
   * 检查文件是否匹配掩码
   */
  private matchesMask(filename: string, mask: string): boolean {
    if (mask === "*" || mask === "*.spk") {
      return filename.toLowerCase().endsWith(".spk");
    }

    const regex = new RegExp(
      "^" + mask.replace(/\./g, "\\.").replace(/\*/g, ".*") + "$",
      "i"
    );
    return regex.test(filename);
  }
}