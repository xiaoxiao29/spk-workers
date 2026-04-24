/**
 * Handler 抽象基类
 *
 * 所有请求处理器都应继承此类
 */

/**
 * Handler 接口
 */
export interface HandlerInterface {
  /**
   * 检查是否能处理该请求
   */
  canHandle(request: Request): boolean;

  /**
   * 处理请求
   */
  handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;
}

/**
 * Handler 抽象基类
 */
export abstract class AbstractHandler implements HandlerInterface {
  /**
   * 检查是否能处理该请求
   */
  abstract canHandle(request: Request): boolean;

  /**
   * 处理请求
   */
  abstract handle(request: Request, env: Env, ctx: ExecutionContext): Promise<Response>;

  /**
   * 创建 JSON 响应
   */
  protected json(data: unknown, init?: ResponseInit): Response {
    return Response.json(data, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...init?.headers,
      },
    });
  }

  /**
   * 创建纯文本响应
   */
  protected text(content: string, init?: ResponseInit): Response {
    return new Response(content, {
      ...init,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        ...init?.headers,
      },
    });
  }

  /**
   * 创建重定向响应
   */
  protected redirect(url: string, status: number = 302): Response {
    return new Response(null, {
      status,
      headers: {
        Location: url,
      },
    });
  }

  /**
   * 验证 API Key
   *
   * 使用 SHA-256 哈希算法安全比对 API Key，防止时序攻击
   *
   * @param apiKey - 从请求头中获取的 API Key
   * @param env - 环境变量，包含配置的 API Key
   * @returns 验证是否通过
   */
  protected async validateApiKey(apiKey: string | null, env: Env): Promise<boolean> {
    if (!apiKey || !env.SSPKS_API_KEY) {
      return false;
    }

    const encoder = new TextEncoder();
    const [providedHash, expectedHash] = await Promise.all([
      crypto.subtle.digest("SHA-256", encoder.encode(apiKey)),
      crypto.subtle.digest("SHA-256", encoder.encode(env.SSPKS_API_KEY)),
    ]);

    return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
  }
}
