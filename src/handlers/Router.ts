/**
 * 请求路由器
 *
 * 负责将请求分发到对应的 Handler
 */


import { HandlerInterface } from "./AbstractHandler";

/**
 * 请求路由器类
 */
export class Router {
  private handlers: HandlerInterface[] = [];

  /**
   * 添加处理器
   */
  addHandler(handler: HandlerInterface): this {
    this.handlers.push(handler);
    return this;
  }

  /**
   * 添加多个处理器
   */
  addHandlers(...handlers: HandlerInterface[]): this {
    this.handlers.push(...handlers);
    return this;
  }

  /**
   * 处理请求
   */
  async handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    for (const handler of this.handlers) {
      if (handler.canHandle(request)) {
        return handler.handle(request, env, ctx);
      }
    }

    // 没有匹配的处理器
    return Response.json(
      { error: { code: "NOT_FOUND", message: "No handler found for this request" } },
      { status: 404 }
    );
  }
}
