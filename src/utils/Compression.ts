/**
 * 响应压缩工具
 *
 * 提供响应压缩功能以减少带宽使用
 */

/**
 * 压缩阈值（字节）
 */
const COMPRESSION_THRESHOLD = 1024; // 1KB

/**
 * 支持压缩的内容类型
 */
const COMPRESSIBLE_TYPES = [
  'application/json',
  'text/html',
  'text/css',
  'text/javascript',
  'application/javascript',
  'text/plain',
  'text/xml',
  'application/xml',
];

/**
 * 检查是否应该压缩
 */
export function shouldCompress(contentType: string, contentLength: number): boolean {
  if (contentLength < COMPRESSION_THRESHOLD) {
    return false;
  }

  return COMPRESSIBLE_TYPES.some(type => 
    contentType.toLowerCase().includes(type)
  );
}

/**
 * 压缩响应
 */
export async function compressResponse(
  data: unknown,
  contentType: string = 'application/json'
): Promise<Response> {
  const json = JSON.stringify(data);
  const contentLength = new TextEncoder().encode(json).length;

  if (!shouldCompress(contentType, contentLength)) {
    return new Response(json, {
      headers: {
        'Content-Type': contentType,
      },
    });
  }

  try {
    const stream = new CompressionStream('gzip');
    const writer = stream.writable.getWriter();
    
    await writer.write(new TextEncoder().encode(json));
    await writer.close();

    return new Response(stream.readable, {
      headers: {
        'Content-Type': contentType,
        'Content-Encoding': 'gzip',
        'Vary': 'Accept-Encoding',
      },
    });
  } catch (e) {
    console.warn('Compression failed, returning uncompressed:', e);
    return new Response(json, {
      headers: {
        'Content-Type': contentType,
      },
    });
  }
}
