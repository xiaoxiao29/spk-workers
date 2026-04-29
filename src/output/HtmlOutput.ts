/**
 * HTML 输出模块
 *
 * 负责渲染 HTML 页面
 * 使用预嵌入的 Mustache 模板
 */

import Mustache from "mustache";
import * as templates from "./templates";

interface TemplateVariables {
  [key: string]: unknown;
}

export class HtmlOutput {
  private config: {
    baseUrl: string;
    baseUrlRelative: string;
    themeUrl: string;
    siteName: string;
    theme: string;
  };

  constructor(
    baseUrl: string,
    baseUrlRelative: string,
    siteName: string,
    theme: string
  ) {
    this.config = {
      baseUrl,
      baseUrlRelative,
      themeUrl: `${baseUrlRelative}themes/${theme}/`,
      siteName,
      theme,
    };
  }

  render(templateName: string, variables: TemplateVariables): string {
    const view = {
      ...this.getBaseVariables(),
      ...variables,
    };

    const templateMap = templates as unknown as Record<string, string>;
    const template = templateMap[templateName];
    if (!template) {
      return this.getErrorTemplate(templateName);
    }

    return Mustache.render(template, view, templates.partials);
  }

  response(templateName: string, variables: TemplateVariables, status: number = 200): Response {
    const html = this.render(templateName, variables);
    return new Response(html, {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'",
      },
    });
  }

  private getBaseVariables(): TemplateVariables {
    return {
      siteName: this.config.siteName,
      baseUrl: this.config.baseUrl,
      baseUrlRelative: this.config.baseUrlRelative,
      themeUrl: this.config.themeUrl,
      theme: this.config.theme,
      year: new Date().getFullYear(),
    };
  }

  private getErrorTemplate(name: string): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>模板未找到</title>
</head>
<body>
  <h1>模板未找到: ${name}</h1>
</body>
</html>`;
  }
}