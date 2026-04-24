/**
 * SSPKS SPK 包解析器
 * 用于解析 Synology 套件包（.spk 文件）并提取包信息和缩略图
 * 支持 TAR.GZ 和 ZIP 格式
 * 使用 pako 库解压，兼容性更好
 *
 * @module SpkParser
 * @author SSPKS Team
 * @version 1.1.0
 */

(() => {
  /** 是否启用调试日志 */
  const DEBUG = false;

  function log(...args) {
    if (DEBUG) console.log('[spk-parser]', ...args);
  }

  /** 默认的包图标文件名 */
  const PACKAGE_ICON_NAME = 'package_icon.png';

  /** TAR 文件头大小（字节） */
  const TAR_HEADER_SIZE = 512;

  /** 图片文件最大大小限制（10MB） */
  const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

  /**
   * 判断文件是否为图片文件（package_icon.png）
   *
   * @param {string} filename - 文件名
   * @returns {boolean} 是否为图片文件
   */
  function isImageFile(filename) {
    const basename = filename.toLowerCase().split('/').pop();
    return /^package_icon(_\d+)?\.(png|jpg|jpeg|gif)$/i.test(basename);
  }

  /**
   * 解析 INFO 文件内容
   *
   * INFO 文件格式为键值对，每行一个配置项：
   * - 支持注释行（以 # 开头）
   * - 支持字符串值（单引号或双引号包裹）
   * - 支持数组值（方括号包裹，逗号分隔）
   *
   * @param {string} content - INFO 文件的原始文本内容
   * @returns {Object} 解析后的键值对对象
   */
  function parseInfoContent(content) {
    const result = {};
    const infoEnd = content.indexOf('\x00');
    const infoPart = infoEnd === -1 ? content : content.substring(0, infoEnd);
    const lines = infoPart.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eqIndex = trimmed.indexOf('=');
      if (eqIndex === -1) continue;

      const key = trimmed.substring(0, eqIndex).trim();
      let value = trimmed.substring(eqIndex + 1).trim();

      // 解析数组格式: [value1, value2, ...]
      if (value.startsWith('[') && value.endsWith(']')) {
        value = value
          .slice(1, -1)
          .split(',')
          .map((v) => v.trim().replace(/^["']|["']$/g, ''))
          .filter((v) => v);
      }
      // 解析双引号字符串
      else if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }
      // 解析单引号字符串
      else if (value.startsWith("'") && value.endsWith("'")) {
        value = value.slice(1, -1);
      }

      result[key] = value;
    }

    return result;
  }

  /**
   * 检查是否为 TAR 文件魔数
   * TAR 文件在偏移量 257 处包含 "ustar" 标识
   *
   * @param {Uint8Array} data - 文件二进制数据
   * @returns {boolean} 是否为 TAR 格式
   */
  function isTarMagic(data) {
    if (data.length < 262) return false;
    // "ustar" = 0x75 0x73 0x74 0x61 0x72
    return (
      data[257] === 0x75 &&
      data[258] === 0x73 &&
      data[259] === 0x74 &&
      data[260] === 0x61 &&
      data[261] === 0x72
    );
  }

  /**
   * 检查是否为 ZIP 文件魔数
   * ZIP 文件魔数: 0x50 0x4B (ASCII: "PK")
   *
   * @param {Uint8Array} data - 文件二进制数据
   * @returns {boolean} 是否为 ZIP 格式
   */
  function isZipMagic(data) {
    if (data.length < 4) return false;
    return (
      data[0] === 0x50 &&
      data[1] === 0x4b &&
      (data[2] === 0x03 || data[2] === 0x05 || data[2] === 0x07) &&
      (data[3] === 0x04 || data[3] === 0x06 || data[3] === 0x08)
    );
  }

  /**
   * 检查是否为 GZIP 格式魔数 (0x1F 0x8B)
   *
   * @param {Uint8Array} data - 文件二进制数据
   * @returns {boolean} 是否为 GZIP 格式
   */
  function isGzipMagic(data) {
    return data.length >= 2 && data[0] === 0x1f && data[1] === 0x8b;
  }

  /**
   * 判断文件名是否为 INFO 文件
   *
   * @param {string} filename - 文件名
   * @returns {boolean}
   */
  function isInfoFile(filename) {
    const name = filename.toLowerCase().split('/').pop();
    return name === 'info';
  }

  /**
   * 从 ZIP 格式文件中提取 INFO 和图片
   *
   * @param {ArrayBuffer} arrayBuffer - ZIP 文件的二进制数据
   * @returns {Promise<{info: string|null, thumbnail: Blob|null}>} 提取结果
   */
  async function extractFromZip(arrayBuffer) {
    log('尝试从 ZIP 提取');

    try {
      const zip = await JSZip.loadAsync(arrayBuffer);
      let infoContent = null;
      let thumbnailBlob = null;

      for (const [filename, file] of Object.entries(zip.files)) {
        if (file.dir) continue;

        if (!infoContent && isInfoFile(filename)) {
          infoContent = await file.async('string');
        } else if (!thumbnailBlob && isImageFile(filename)) {
          try {
            const blob = await file.async('blob');
            if (blob && blob.size > 0) {
              thumbnailBlob = blob;
            }
          } catch (e) {
            log('提取图片失败:', e);
          }
        }
      }

      return { info: infoContent, thumbnail: thumbnailBlob };
    } catch (e) {
      console.error('[spk-parser] 从 ZIP 提取时出错:', e);
      return { info: null, thumbnail: null };
    }
  }

  /**
   * 解析 TAR 文件头中的八进制大小字段
   *
   * @param {Uint8Array} header - 512 字节的 TAR 文件头
   * @param {TextDecoder} decoder
   * @returns {number} 文件大小，解析失败返回 0
   */
  function parseTarFileSize(header, decoder) {
    const sizeOctal = decoder.decode(header.subarray(124, 136)).trim();
    const size = parseInt(sizeOctal, 8);
    return isNaN(size) ? 0 : size;
  }

  /**
   * 解析 TAR 文件头中的文件名
   *
   * @param {Uint8Array} header - 512 字节的 TAR 文件头
   * @param {TextDecoder} decoder
   * @returns {string} 文件名
   */
  function parseTarFileName(header, decoder) {
    const nameBytes = header.subarray(0, 100);
    let nameEnd = 0;
    while (nameEnd < nameBytes.length && nameBytes[nameEnd] !== 0) nameEnd++;
    return decoder.decode(nameBytes.subarray(0, nameEnd));
  }

  /**
   * 从 TAR.GZ 格式文件中提取 INFO 和图片
   *
   * @param {ArrayBuffer} arrayBuffer - TAR.GZ 文件的二进制数据
   * @returns {Promise<{info: string|null, thumbnail: Blob|null}>} 提取结果
   */
  async function extractFromTarGz(arrayBuffer) {
    log('尝试从 TAR.GZ 提取');

    const buffer = new Uint8Array(arrayBuffer);

    if (!isGzipMagic(buffer)) {
      log('不是有效的 GZIP 格式，跳过');
      return { info: null, thumbnail: null };
    }

    try {
      let decompressedBuffer;

      // 优先使用 pako 库解压，兼容性更好
      if (window.pako) {
        decompressedBuffer = pako.ungzip(buffer);
      } else {
        // 降级使用浏览器原生 DecompressionStream
        const ds = new DecompressionStream('gzip');
        const decompressedStream = new Response(buffer).body.pipeThrough(ds);
        const decompressed = await new Response(decompressedStream).arrayBuffer();
        decompressedBuffer = new Uint8Array(decompressed);
      }

      if (!isTarMagic(decompressedBuffer)) {
        log('解压后不是有效的 TAR 文件');
        return { info: null, thumbnail: null };
      }

      const textDecoder = new TextDecoder('utf-8');
      let offset = 0;
      let infoContent = null;
      let thumbnailData = null;

      // 遍历 TAR 文件条目
      while (offset + TAR_HEADER_SIZE <= decompressedBuffer.length) {
        const header = decompressedBuffer.subarray(offset, offset + TAR_HEADER_SIZE);
        const filename = parseTarFileName(header, textDecoder);
        const fileSize = parseTarFileSize(header, textDecoder);

        // 空文件名表示 TAR 结束
        if (!filename) {
          break;
        }

        const contentOffset = offset + TAR_HEADER_SIZE;
        const contentEnd = contentOffset + fileSize;

        if (fileSize > 0 && contentEnd <= decompressedBuffer.length) {
          if (!infoContent && isInfoFile(filename)) {
            infoContent = textDecoder.decode(
              decompressedBuffer.subarray(contentOffset, contentEnd)
            );
          } else if (!thumbnailData && isImageFile(filename) && fileSize < MAX_IMAGE_SIZE) {
            thumbnailData = decompressedBuffer.slice(contentOffset, contentEnd);
          }
        }

        // 移动到下一个条目（文件头 + 内容向上取整到 512 字节边界）
        offset += TAR_HEADER_SIZE + Math.ceil(fileSize / TAR_HEADER_SIZE) * TAR_HEADER_SIZE;
      }

      const thumbnailBlob = thumbnailData
        ? new Blob([thumbnailData], { type: 'image/png' })
        : null;

      return { info: infoContent, thumbnail: thumbnailBlob };
    } catch (e) {
      console.error('[spk-parser] 从 TAR.GZ 提取时出错:', e);
      return { info: null, thumbnail: null };
    }
  }

  /**
   * 从纯 TAR 格式文件中提取 INFO 和图片
   *
   * @param {ArrayBuffer} arrayBuffer - TAR 文件的二进制数据
   * @returns {Promise<{info: string|null, thumbnail: Blob|null}>} 提取结果
   */
  async function extractFromTar(arrayBuffer) {
    log('从纯 TAR 提取');

    const buffer = new Uint8Array(arrayBuffer);

    if (!isTarMagic(buffer)) {
      log('不是有效的 TAR 文件，跳过');
      return { info: null, thumbnail: null };
    }

    try {
      const textDecoder = new TextDecoder('utf-8');
      let offset = 0;
      let infoContent = null;
      let thumbnailData = null;

      while (offset + TAR_HEADER_SIZE <= buffer.length) {
        const header = buffer.subarray(offset, offset + TAR_HEADER_SIZE);
        const filename = parseTarFileName(header, textDecoder);
        const fileSize = parseTarFileSize(header, textDecoder);

        if (!filename) {
          break;
        }

        const contentOffset = offset + TAR_HEADER_SIZE;
        const contentEnd = contentOffset + fileSize;

        if (fileSize > 0 && contentEnd <= buffer.length) {
          if (!infoContent && isInfoFile(filename)) {
            infoContent = textDecoder.decode(
              buffer.subarray(contentOffset, contentEnd)
            );
            log('找到 INFO 文件:', filename);
          } else if (!thumbnailData && isImageFile(filename) && fileSize < MAX_IMAGE_SIZE) {
            thumbnailData = buffer.slice(contentOffset, contentEnd);
            log('找到图片文件:', filename, '大小:', fileSize);
          }
        }

        offset += TAR_HEADER_SIZE + Math.ceil(fileSize / TAR_HEADER_SIZE) * TAR_HEADER_SIZE;
      }

      const thumbnailBlob = thumbnailData
        ? new Blob([thumbnailData], { type: 'image/png' })
        : null;

      return { info: infoContent, thumbnail: thumbnailBlob };
    } catch (e) {
      console.error('[spk-parser] 从 TAR 提取时出错:', e);
      return { info: null, thumbnail: null };
    }
  }

  /**
   * 全文搜索 INFO（用于非标准格式）
   *
   * 当文件格式无法识别时，尝试在整个文件内容中搜索 INFO 信息。
   * 使用 latin1 编码解码以保留所有字节值，避免 UTF-8 替换字符干扰匹配。
   *
   * @param {Uint8Array} buffer - 文件二进制数据
   * @returns {{info: string|null, thumbnail: null}} 搜索结果
   */
  function searchInfoInFile(buffer) {
    log('开始全文件搜索 INFO');

    // 使用 latin1 (iso-8859-1) 解码，保留所有字节值不会产生替换字符
    const content = Array.from(buffer, (b) => String.fromCharCode(b)).join('');

    if (content.indexOf('package=') === -1) {
      return { info: null, thumbnail: null };
    }

    const keyPatterns = ['\ncur_os=', '\nversion=', '\npackage=', 'package='];
    const candidates = [];

    for (const pattern of keyPatterns) {
      let idx = content.indexOf(pattern);
      while (idx !== -1) {
        const start = pattern === 'package=' ? idx : idx + 1;
        let end = content.indexOf('\x00', start);
        if (end === -1) end = content.length;

        const infoContent = content.substring(start, end).trim();
        const hasPackage = infoContent.indexOf('package=') !== -1;
        const hasVersion = infoContent.indexOf('version=') !== -1;

        candidates.push({ length: infoContent.length, content: infoContent, hasPackage, hasVersion });

        idx = content.indexOf(pattern, idx + 1);
      }
    }

    // 按内容长度降序排序
    candidates.sort((a, b) => b.length - a.length);

    // 优先选择包含 package 和 version 且长度足够的内容
    for (const c of candidates) {
      if (c.hasPackage && c.hasVersion && c.length > 100) {
        return { info: c.content, thumbnail: null };
      }
    }

    // 降级选择只包含 package 且长度足够的内容
    for (const c of candidates) {
      if (c.hasPackage && c.length > 50) {
        return { info: c.content, thumbnail: null };
      }
    }

    return { info: null, thumbnail: null };
  }

  /**
   * 从 SPK 文件中提取包信息和缩略图
   *
   * 检测顺序：
   * 1. ZIP 魔数 → JSZip 解压
   * 2. GZIP 魔数 → pako 解压 + TAR 解析
   * 3. "## S" 开头 → 原始 INFO 格式
   * 4. 文件头包含 "package=" → 直接 INFO 格式
   * 5. 全文搜索 INFO 内容
   *
   * @param {File} file - SPK 文件对象
   * @returns {Promise<Object|null>} 包信息对象，解析失败返回 null
   */
  async function extractInfo(file) {
    log('开始提取，文件名:', file.name, '大小:', file.size);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);
      let result = { info: null, thumbnail: null };

      // 1. 优先检测归档格式（魔数是确定性的，不会误判）
      if (isZipMagic(buffer)) {
        log('检测到 ZIP 格式');
        result = await extractFromZip(arrayBuffer);
      } else if (isGzipMagic(buffer)) {
        log('检测到 GZIP 格式');
        result = await extractFromTarGz(arrayBuffer);
      } else if (isTarMagic(buffer)) {
        log('检测到纯 TAR 格式');
        result = await extractFromTar(arrayBuffer);
      }

      // 2. 检测原始 INFO 格式（以 "## S" 开头）
      if (!result.info && buffer.length >= 4) {
        if (buffer[0] === 0x23 && buffer[1] === 0x23 && buffer[2] === 0x20 && buffer[3] === 0x53) {
          result.info = new TextDecoder('utf-8').decode(buffer);
          log('检测到原始 INFO 格式');
        }
      }

      // 3. 检测直接 INFO 格式（文件开头就是 INFO 键值对）
      if (!result.info) {
        const sliceSize = Math.min(2048, buffer.length);
        const directInfo = new TextDecoder('utf-8').decode(buffer.subarray(0, sliceSize));
        const infoEndCheck = directInfo.indexOf('\x00');
        const infoPart = infoEndCheck === -1 ? directInfo : directInfo.substring(0, infoEndCheck);

        if (infoPart.length > 100 && infoPart.indexOf('package=') >= 0) {
          result.info = infoPart;
          log('检测到直接 INFO 格式');
        }
      }

      // 4. 最后尝试全文件搜索
      if (!result.info) {
        log('尝试全文件搜索 INFO 内容');
        result = searchInfoInFile(buffer);
      }

      if (!result.info) {
        console.error('[spk-parser] 无法从文件中提取 INFO');
        return null;
      }

      const parsedInfo = parseInfoContent(result.info);

      return {
        ...parsedInfo,
        _thumbnail: result.thumbnail,
        _rawInfo: result.info,
      };
    } catch (e) {
      console.error('[spk-parser] 提取信息时出错:', e);
      return null;
    }
  }

  /**
   * 导出的公共 API
   */
  window.SpkParser = {
    extractInfo,
    parseInfoContent,
    isImageFile,
  };

  log('加载完成');
})();
