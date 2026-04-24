/**
 * 上传页面处理器
 *
 * 返回 SPK 上传页面的 HTML
 */

import { AbstractHandler } from "./AbstractHandler";
import { Config } from "../config/Config";
import { HtmlOutput } from "../output/HtmlOutput";

/**
 * 上传页面处理器
 */
export class UploadPageHandler extends AbstractHandler {
  private htmlOutput: HtmlOutput;

  constructor(private config: Config) {
    super();
    this.htmlOutput = new HtmlOutput(
      this.config.baseUrl,
      this.config.baseUrlRelative,
      this.config.site.name,
      this.config.site.theme
    );
  }

  /**
   * 检查是否能处理该请求
   */
  canHandle(request: Request): boolean {
    const url = new URL(request.url);
    return url.pathname === "/upload";
  }

  /**
   * 处理请求
   */
  async handle(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    return this.htmlOutput.response("html_upload", {});
  }
}
