/**
 * 模板缓存管理器
 *
 * 提供模板缓存功能以提升渲染性能
 */

import Mustache from 'mustache';

/**
 * 模板缓存
 */
const templateCache: Map<string, string> = new Map();

/**
 * 模板缓存管理器
 */
export class TemplateCache {
  /**
   * 获取模板（带缓存）
   */
  static async getTemplate(name: string, loader: () => Promise<string>): Promise<string> {
    if (templateCache.has(name)) {
      return templateCache.get(name)!;
    }

    const template = await loader();
    templateCache.set(name, template);
    return template;
  }

  /**
   * 渲染模板（带缓存）
   */
  static async render(
    name: string,
    data: unknown,
    loader: () => Promise<string>
  ): Promise<string> {
    const template = await this.getTemplate(name, loader);
    return Mustache.render(template, data);
  }

  /**
   * 清除缓存
   */
  static clear(name?: string): void {
    if (name) {
      templateCache.delete(name);
    } else {
      templateCache.clear();
    }
  }

  /**
   * 获取缓存大小
   */
  static size(): number {
    return templateCache.size;
  }

  /**
   * 检查模板是否已缓存
   */
  static has(name: string): boolean {
    return templateCache.has(name);
  }
}
