/**
 * 404 处理器
 *
 * 处理未找到的请求
 */

import { AbstractHandler } from "./AbstractHandler";

/**
 * 404 处理器
 */
export class NotFoundHandler extends AbstractHandler {
  /**
   * 检查是否能处理该请求
   */
  canHandle(_request: Request): boolean {
    return true;
  }

  /**
   * 处理请求
   */
  async handle(_request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(_request.url);

    return Response.json(
      {
        error: {
          code: "NOT_FOUND",
          message: `Cannot ${_request.method} ${url.pathname}`,
        },
      },
      { status: 404 }
    );
  }
}
