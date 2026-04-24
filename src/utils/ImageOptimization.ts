/**
 * 图片优化工具
 *
 * 提供图片优化相关功能
 */

/**
 * 支持的图片格式
 */
export const SUPPORTED_IMAGE_FORMATS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'] as const;

/**
 * 图片优化配置
 */
export interface ImageOptimizationConfig {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'png' | 'jpeg';
}

/**
 * 默认优化配置
 */
const DEFAULT_CONFIG: ImageOptimizationConfig = {
  maxWidth: 512,
  maxHeight: 512,
  quality: 85,
  format: 'webp',
};

/**
 * 检查是否为支持的图片格式
 */
export function isSupportedImageFormat(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return (SUPPORTED_IMAGE_FORMATS as readonly string[]).includes(ext);
}

/**
 * 获取优化的图片 URL
 *
 * 注意：Cloudflare Image Resizing 需要启用该功能
 */
export function getOptimizedImageUrl(
  originalUrl: string,
  config: ImageOptimizationConfig = {}
): string {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!originalUrl || originalUrl.startsWith('data:')) {
    return originalUrl;
  }

  if (originalUrl.startsWith('http://') || originalUrl.startsWith('https://')) {
    const url = new URL(originalUrl);
    
    if (finalConfig.format) {
      url.searchParams.set('format', finalConfig.format);
    }
    if (finalConfig.quality) {
      url.searchParams.set('quality', finalConfig.quality.toString());
    }
    if (finalConfig.maxWidth) {
      url.searchParams.set('width', finalConfig.maxWidth.toString());
    }
    if (finalConfig.maxHeight) {
      url.searchParams.set('height', finalConfig.maxHeight.toString());
    }

    return url.toString();
  }

  return originalUrl;
}

/**
 * 生成响应式图片 srcset
 */
export function generateSrcSet(
  baseUrl: string,
  sizes: number[] = [128, 256, 512]
): string {
  return sizes
    .map(size => `${getOptimizedImageUrl(baseUrl, { maxWidth: size })} ${size}w`)
    .join(', ');
}

/**
 * 获取图片 MIME 类型
 */
export function getImageMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
  };

  return mimeTypes[ext] || 'application/octet-stream';
}
