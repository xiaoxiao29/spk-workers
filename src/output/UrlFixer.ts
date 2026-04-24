/**
 * URL 修复工具模块
 *
 * 负责修复和规范化 SPK 包相关的 URL
 */

export class UrlFixer {
  private baseUrl: string;
  private basePath: string;
  private externalStorageUrl?: string;

  constructor(baseUrl: string, basePath: string = "/", externalStorageUrl?: string) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.basePath = basePath.replace(/\/$/, "") || "/";
    this.externalStorageUrl = externalStorageUrl;
  }

  fixPackageUrl(relativePath: string): string {
    if (relativePath.startsWith("http://") || relativePath.startsWith("https://")) {
      return relativePath;
    }

    if (relativePath.startsWith("//")) {
      return `https:${relativePath}`;
    }

    if (relativePath.startsWith("/")) {
      return `${this.baseUrl}${relativePath}`;
    }

    const basePath = this.basePath === "/" ? "" : this.basePath;
    return `${this.baseUrl}${basePath}/${relativePath}`;
  }

  fixThumbnailUrl(thumbnailPath: string, packageName: string): string {
    if (!thumbnailPath) {
      return this.getDefaultThumbnail(packageName);
    }
    return this.fixIconUrl(thumbnailPath);
  }

  fixDownloadUrl(filename: string, arch?: string | null, build?: string | null): string {
    let url: string;
    if (this.externalStorageUrl) {
      url = `${this.externalStorageUrl}packages/${filename}`;
    } else {
      url = `${this.baseUrl}/packages/${filename}`;
    }

    if (arch && build) {
      url += `?arch=${encodeURIComponent(arch)}&build=${encodeURIComponent(build)}`;
    }

    return url;
  }

  fixIconUrl(iconPath: string): string {
    if (iconPath.startsWith("http://") || iconPath.startsWith("https://")) {
      return iconPath;
    }
    return this.fixPackageUrl(iconPath);
  }

  getDefaultThumbnail(_packageName: string): string {
    return `${this.baseUrl}${this.basePath}images/default_package_icon_72.png`;
  }

  getDefaultIcon(_packageName: string): string {
    return `${this.baseUrl}${this.basePath}images/default_package_icon_120.png`;
  }

  getThemeUrl(theme: string): string {
    return `${this.baseUrl}${this.basePath}_themes/${theme}/`;
  }

  getBaseUrl(): string {
    return this.baseUrl;
  }

  getBasePath(): string {
    return this.basePath;
  }
}
