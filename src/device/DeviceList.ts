/**
 * 设备列表模块
 *
 * 负责管理 Synology 设备型号和架构的映射关系
 */

import YAML from "yaml";

/**
 * 设备信息
 */
export interface DeviceInfo {
  arch: string;
  name: string;
  family: string;
}

/**
 * 设备列表配置
 */
interface DeviceListConfig {
  [family: string]: {
    [arch: string]: string[];
  };
}

/**
 * 设备列表类
 */
export class DeviceList {
  private devices: DeviceInfo[] = [];
  private familyArchMap: Map<string, string> = new Map();

  constructor(content?: string) {
    if (content) {
      this.parseConfig(content);
    }
  }

  /**
   * 获取所有设备
   */
  getDevices(): DeviceInfo[] {
    return this.devices;
  }

  /**
   * 获取架构列表
   */
  getArchList(): string[] {
    const archs = new Set<string>();
    for (const device of this.devices) {
      archs.add(device.arch);
    }
    return Array.from(archs).sort();
  }

  /**
   * 获取设备列表（按架构分组）
   */
  getDevicesByFamily(): Map<string, DeviceInfo[]> {
    const families = new Map<string, DeviceInfo[]>();

    for (const device of this.devices) {
      const existing = families.get(device.family);
      if (existing) {
        existing.push(device);
      } else {
        families.set(device.family, [device]);
      }
    }

    return families;
  }

  /**
   * 根据架构获取设备
   */
  getDevicesByArch(arch: string): DeviceInfo[] {
    return this.devices.filter((d) => d.arch === arch);
  }

  /**
   * 获取架构所属系列
   */
  getFamily(arch: string): string {
    return this.familyArchMap.get(arch) || arch;
  }

  /**
   * 解析配置文件
   */
  private parseConfig(content: string): void {
    if (!content || !content.trim()) {
      return;
    }

    const config = YAML.parse(content) as DeviceListConfig;

    if (!config || typeof config !== "object") {
      return;
    }

    for (const [family, archList] of Object.entries(config)) {
      if (!archList || typeof archList !== "object") continue;
      for (const [arch, models] of Object.entries(archList)) {
        if (!Array.isArray(models)) continue;
        for (const model of models) {
          if (model) {
            this.devices.push({
              arch,
              name: model,
              family,
            });
          }
        }
        this.familyArchMap.set(arch, family);
      }
    }

    this.devices.sort((a, b) => a.name.localeCompare(b.name));
  }
}
