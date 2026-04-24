/**
 * 配置管理模块
 *
 * 负责加载和管理 SPK Workers 的配置
 * 支持从环境变量和 R2 存储加载配置
 */

import YAML from "yaml";

/**
 * 站点配置
 */
export interface SiteConfig {
  name: string;
  theme: string;
  redirectindex?: string;
}

/**
 * 包配置
 */
export interface PackagesConfig {
  file_mask: string;
}

/**
 * 路径配置
 */
export interface PathsConfig {
  cache: string;
  models: string;
  packages: string;
  themes: string;
}

/**
 * 完整配置
 */
export interface ConfigData {
  site: SiteConfig;
  packages: PackagesConfig;
  paths: PathsConfig;
  excludedSynoServices: string[];
}

/**
 * 配置类
 */
export class Config {
  site: SiteConfig;
  packages: PackagesConfig;
  paths: PathsConfig;
  excludedSynoServices: string[];
  storageBackend: 'kv' | 'd1' | 'hybrid';
  externalStorageUrl?: string;

  // 基础 URL
  baseUrl: string;
  baseUrlRelative: string;
  basePath: string;

  constructor(
    private env: Env,
    baseUrl: string = "",
    basePath: string = ""
  ) {
    this.baseUrl = baseUrl;
    this.basePath = basePath;
    this.baseUrlRelative = basePath || "./";

    // 初始化默认值
    this.site = this.loadSiteConfig();
    this.packages = this.loadPackagesConfig();
    this.paths = this.loadPathsConfig();
    this.excludedSynoServices = [];
    this.storageBackend = this.loadStorageBackend();
    this.externalStorageUrl = this.env.SSPKS_EXTERNAL_STORAGE_URL 
      ? this.env.SSPKS_EXTERNAL_STORAGE_URL.replace(/\/$/, "") + "/" 
      : undefined;
  }

  /**
   * 获取下载 URL
   */
  getDownloadUrl(filename: string): string {
    if (this.externalStorageUrl) {
      return `${this.externalStorageUrl}packages/${filename}`;
    }
    return `${this.baseUrl}/packages/${filename}`;
  }

  /**
   * 加载存储后端配置
   */
  private loadStorageBackend(): 'kv' | 'd1' | 'hybrid' {
    const backend = this.env.SSPKS_STORAGE_BACKEND;
    if (backend === 'd1' || backend === 'kv' || backend === 'hybrid') {
      return backend;
    }
    return 'hybrid';
  }

  /**
   * 加载站点配置
   */
  private loadSiteConfig(): SiteConfig {
    return {
      name: this.env.SSPKS_SITE_NAME || "Simple SPK Server",
      theme: this.env.SSPKS_SITE_THEME || "material",
      redirectindex: this.env.SSPKS_SITE_REDIRECTINDEX,
    };
  }

  /**
   * 加载包配置
   */
  private loadPackagesConfig(): PackagesConfig {
    return {
      file_mask: this.env.SSPKS_PACKAGES_FILE_MASK || "*.spk",
    };
  }

  /**
   * 加载路径配置
   */
  private loadPathsConfig(): PathsConfig {
    return {
      cache: "cache/",
      models: "conf/synology_models.yaml",
      packages: "packages/",
      themes: "themes/",
    };
  }

  /**
   * 获取包前缀
   */
  get packagesPrefix(): string {
    return this.paths.packages;
  }

  /**
   * 获取缓存前缀
   */
  get cachePrefix(): string {
    return this.paths.cache;
  }
}

/**
 * 解析 YAML 内容
 */
export function parseYaml(content: string): unknown {
  return YAML.parse(content);
}
