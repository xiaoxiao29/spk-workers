/**
 * 包过滤器模块
 *
 * 负责根据架构、固件、通道等条件过滤包列表
 */

import { PackageInfo } from "./Package";

/**
 * 包过滤器类
 */
export class PackageFilter {
  private arch: string | null = null;
  private firmware: string | false = false;
  private beta: boolean | null = null;
  private packages: PackageInfo[] = [];

  constructor(packages: PackageInfo[] = []) {
    this.packages = packages;
  }

  /**
   * 设置包列表
   */
  setPackages(packages: PackageInfo[]): this {
    this.packages = packages;
    return this;
  }

  /**
   * 设置架构过滤
   */
  setArchitectureFilter(arch: string | null): this {
    this.arch = arch;
    return this;
  }

  /**
   * 设置固件版本过滤
   */
  setFirmwareVersionFilter(firmware: string | false): this {
    this.firmware = firmware;
    return this;
  }

  /**
   * 设置 Beta 通道过滤
   */
  setBetaFilter(beta: boolean | null): this {
    this.beta = beta;
    return this;
  }

  /**
   * 获取过滤后的包列表
   */
  getFilteredPackageList(): PackageInfo[] {
    return this.packages.filter((pkg) => {
      // 架构过滤
      if (this.arch) {
        const archs = pkg.metadata.arch || [];
        if (!archs.includes(this.arch) && !archs.includes("noarch")) {
          return false;
        }
      }

      // 固件过滤
      if (this.firmware !== false) {
        const required = pkg.metadata.firmware;
        if (required && !this.isCompatibleFirmware(this.firmware, required)) {
          return false;
        }
      }

      // Beta 过滤
      if (this.beta !== null) {
        const isBeta = pkg.metadata.beta === true;
        if (isBeta !== this.beta) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * 检查固件兼容性
   */
  private isCompatibleFirmware(current: string, required: string): boolean {
    const parse = (v: string) => {
      const parts = v.split(".").map(Number);
      return { major: parts[0] || 0, minor: parts[1] || 0 };
    };

    const c = parse(current);
    const r = parse(required);

    if (c.major !== r.major) return c.major >= r.major;
    return c.minor >= r.minor;
  }

  /**
   * 按名称分组
   */
  groupByName(): Map<string, PackageInfo[]> {
    const groups = new Map<string, PackageInfo[]>();

    for (const pkg of this.packages) {
      const name = pkg.metadata.package || pkg.filename;
      const existing = groups.get(name);
      if (existing) {
        existing.push(pkg);
      } else {
        groups.set(name, [pkg]);
      }
    }

    return groups;
  }

  /**
   * 获取最新版本
   */
  getLatestVersion(name: string): PackageInfo | null {
    const pkgs = this.packages.filter((p) => (p.metadata.package || p.filename) === name);
    if (pkgs.length === 0) return null;

    return pkgs.reduce((latest, current) => {
      const latestVer = this.parseVersion(latest.metadata.version);
      const currentVer = this.parseVersion(current.metadata.version);
      return currentVer > latestVer ? current : latest;
    });
  }

  /**
   * 解析版本号
   */
  private parseVersion(version: string): { major: number; minor: number; patch: number } {
    const parts = version.split(".").map(Number);
    return {
      major: parts[0] || 0,
      minor: parts[1] || 0,
      patch: parts[2] || 0,
    };
  }
}
