/**
 * 缓存键构建器
 *
 * 提供统一的缓存键生成和管理
 */

export class CacheKeyBuilder {
  private static readonly PREFIX = {
    PACKAGE: 'pkg',
    PACKAGE_LIST: 'index:arch',
    ALL_INDEX: 'index:all',
    PACKAGE_DETAIL: 'packages:detail',
    ICON: 'static:icons',
    DEVICE_CONFIG: 'config:models',
    ASSET: 'static:assets',
    THUMBNAIL: 'thumbnails',
  };

  /**
   * 包数据缓存键（兼容现有格式）
   */
  static forPackage(name: string): string {
    return `${this.PREFIX.PACKAGE}:${name}`;
  }

  /**
   * 架构索引缓存键
   */
  static forArchIndex(arch: string): string {
    return `${this.PREFIX.PACKAGE_LIST}:${arch}`;
  }

  /**
   * 全局索引缓存键
   */
  static forAllIndex(): string {
    return this.PREFIX.ALL_INDEX;
  }

  /**
   * 包列表缓存键
   */
  static forPackageList(arch: string, channel: string = 'stable'): string {
    return `${this.PREFIX.PACKAGE_LIST}:${arch}:${channel}`;
  }

  /**
   * 包详情缓存键
   */
  static forPackageDetail(name: string): string {
    return `${this.PREFIX.PACKAGE_DETAIL}:${name}`;
  }

  /**
   * 图标缓存键
   */
  static forIcon(name: string): string {
    return `${this.PREFIX.ICON}:${name}.png`;
  }

  /**
   * 设备配置缓存键
   */
  static forDeviceConfig(path: string): string {
    return `${this.PREFIX.DEVICE_CONFIG}:${path}`;
  }

  /**
   * 静态资源缓存键
   */
  static forAsset(path: string): string {
    return `${this.PREFIX.ASSET}:${path}`;
  }

  /**
   * 缩略图缓存键
   */
  static forThumbnail(packageName: string): string {
    return `${this.PREFIX.THUMBNAIL}:${packageName}`;
  }

  /**
   * 解析缓存键类型
   */
  static parseKeyType(key: string): string {
    const parts = key.split(':');
    return parts[0] || 'unknown';
  }
}

/**
 * 缓存 TTL 配置
 */
export const CACHE_TTL = {
  STATIC_ASSETS: 86400,      // 静态资源：24小时
  PACKAGE_LIST: 300,         // 包列表：5分钟
  PACKAGE_DETAIL: 600,       // 包详情：10分钟
  DEVICE_CONFIG: 3600,       // 设备配置：1小时
  ICON: 86400,               // 图标：24小时
  THUMBNAIL: 3600,           // 缩略图：1小时
  API_RESPONSE: 60,          // API 响应：1分钟
} as const;
