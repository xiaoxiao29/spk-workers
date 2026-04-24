/**
 * 统一的上传脚本到 R2
 *
 * 支持上传配置文件和静态资源目录
 * 使用本地缓存校验码来避免重复上传
 *
 * 选项:
 *   --dry-run    只显示将要执行的操作，不实际上传
 *   --force      跳过校验码检查，强制上传所有文件
 *   --verbose    显示详细日志
 *   --quiet      只显示关键信息
 *   --cleanup    清理 R2 中存在但本地不存在的文件
 *   --config     只上传配置文件 (conf/)
 *   --themes     只上传主题文件 (themes/)
 *   --public     只上传公共文件 (public/)
 *   --all        上传所有 (默认)
 *   --clear-cache 清除本地校验码缓存
 */

import { createHash } from 'crypto';
import { readFile, unlink, readdir, writeFile, access } from 'fs/promises';
import { spawn } from 'child_process';
import { join } from 'path';

const R2_BUCKET = 'spks';
const CACHE_FILE = '.upload-cache.json';

const UPLOAD_TARGETS = {
  config: {
    localPath: 'conf/synology_models.yaml',
    r2Path: 'conf/synology_models.yaml',
    description: 'Config file'
  },
  themes: {
    localDir: 'themes',
    r2Prefix: 'themes',
    description: 'Theme files'
  },
  public: {
    localDir: 'public',
    r2Prefix: 'public',
    description: 'Public files'
  }
};

const IGNORE_PATTERNS = ['.DS_Store', '.DS_Store?', '.Spotlight-V100', '.Trashes', '._*', '.git', '.gitignore'];
const COMMAND_TIMEOUT = 60000;

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run') || args.includes('-n');
const FORCE = args.includes('--force') || args.includes('-f');
const VERBOSE = args.includes('--verbose') || args.includes('-v');
const QUIET = args.includes('--quiet') || args.includes('-q');
const CLEANUP = args.includes('--cleanup') || args.includes('-c');
const CLEAR_CACHE = args.includes('--clear-cache');

const TARGET_CONFIG = args.includes('--config');
const TARGET_THEMES = args.includes('--themes');
const TARGET_PUBLIC = args.includes('--public');
const TARGET_ALL = args.includes('--all') || (!TARGET_CONFIG && !TARGET_THEMES && !TARGET_PUBLIC);

let checksumCache = {};

function log(level, ...messages) {
  if (QUIET && level === 'debug') return;
  if (!VERBOSE && level === 'debug') return;
  const prefix = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
    debug: '▸'
  };
  console.log(`${prefix[level] || ''}`, ...messages);
}

function md5(content) {
  return createHash('md5').update(content).digest('hex');
}

async function loadChecksumCache() {
  try {
    await access(CACHE_FILE);
    const content = await readFile(CACHE_FILE, 'utf-8');
    checksumCache = JSON.parse(content);
    log('debug', `Loaded ${Object.keys(checksumCache).length} cached checksums`);
  } catch (error) {
    log('debug', 'No existing cache file, starting fresh');
    checksumCache = {};
  }
}

async function saveChecksumCache() {
  try {
    await writeFile(CACHE_FILE, JSON.stringify(checksumCache, null, 2), 'utf-8');
    log('debug', `Saved ${Object.keys(checksumCache).length} checksums to cache`);
  } catch (error) {
    log('warning', `Failed to save cache: ${error.message}`);
  }
}

function getCachedChecksum(filePath) {
  return checksumCache[filePath] || null;
}

function updateCachedChecksum(filePath, checksum) {
  checksumCache[filePath] = checksum;
}

function clearCache() {
  checksumCache = {};
  log('success', 'Cache cleared');
}

function runCommand(cmd, cmdArgs, timeout = COMMAND_TIMEOUT) {
  return new Promise((resolve, reject) => {
    if (DRY_RUN) {
      log('debug', `Would run: ${cmd} ${cmdArgs.join(' ')}`);
      resolve('');
      return;
    }

    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms: ${cmd} ${cmdArgs.join(' ')}`));
    }, timeout);

    const proc = spawn(cmd, cmdArgs, { shell: true });
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve(stdout);
      } else {
        let errorMsg = stderr;
        if (stderr.includes('Failed to fetch auth token') || stderr.includes('CLOUDFLARE_API_TOKEN')) {
          errorMsg = `认证失败: 请设置 CLOUDFLARE_API_TOKEN 环境变量\n` +
            `解决方案:\n` +
            `1. 运行 'wrangler login' 进行交互式登录，或\n` +
            `2. 创建 API Token: https://dash.cloudflare.com/profile/api-tokens\n` +
            `3. 设置环境变量: export CLOUDFLARE_API_TOKEN="your-token"\n\n` +
            `原始错误: ${stderr}`;
        }
        reject(new Error(`Command failed: ${errorMsg}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function getAllFiles(dir) {
  let files = [];
  try {
    const items = await readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (IGNORE_PATTERNS.some(pattern => {
        if (pattern.endsWith('*')) {
          return item.name.startsWith(pattern.slice(0, -1));
        }
        return item.name === pattern;
      })) {
        continue;
      }
      const fullPath = join(dir, item.name);
      if (item.isDirectory()) {
        files = files.concat(await getAllFiles(fullPath));
      } else {
        files.push(fullPath);
      }
    }
  } catch (error) {
    log('warning', `Cannot read directory ${dir}: ${error.message}`);
  }
  return files;
}

async function getFileChecksum(filePath) {
  const content = await readFile(filePath);
  return md5(content);
}

async function uploadFile(localFile, r2Path) {
  log('info', `Uploading ${localFile} -> ${r2Path}`);
  await runCommand('wrangler', [
    'r2',
    'object',
    'put',
    r2Path,
    '--file',
    localFile,
    '--remote'
  ]);
}

async function getRemoteFiles(bucket, prefix) {
  const allFiles = [];

  try {
    const output = await runCommand('wrangler', [
      'r2',
      'object',
      'list',
      bucket,
      '--prefix',
      prefix,
      '--json'
    ]);

    if (output) {
      const lines = output.trim().split('\n').filter(line => line.trim());
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          if (obj.key) {
            allFiles.push(obj.key);
          }
        } catch {}
      }
    }
  } catch (error) {
    log('debug', `Cannot list remote files: ${error.message}`);
  }

  return allFiles;
}

async function deleteRemoteFile(r2Path) {
  log('info', `Deleting ${r2Path}`);
  await runCommand('wrangler', [
    'r2',
    'object',
    'delete',
    R2_BUCKET,
    r2Path,
    '--remote'
  ]);
}

async function uploadSingleFile(localFile, r2Path, description) {
  log('info', `Uploading ${description}...`);
  log('info', `Source: ${localFile}`);
  log('info', `Destination: ${R2_BUCKET}/${r2Path}`);

  let shouldUpload = true;
  let skipReason = '';

  if (!FORCE) {
    const currentChecksum = await getFileChecksum(localFile);
    const cachedChecksum = getCachedChecksum(localFile);

    if (cachedChecksum && currentChecksum === cachedChecksum) {
      shouldUpload = false;
      skipReason = 'unchanged (cached)';
    } else {
      log('debug', `Checksum changed: ${cachedChecksum || 'none'} -> ${currentChecksum}`);
    }
  }

  if (shouldUpload) {
    if (DRY_RUN) {
      log('info', `Would upload: ${localFile}`);
    } else {
      await uploadFile(localFile, `${R2_BUCKET}/${r2Path}`);
      const currentChecksum = await getFileChecksum(localFile);
      updateCachedChecksum(localFile, currentChecksum);
    }
    log('success', `Uploaded: ${localFile}`);
    return { uploaded: 1, skipped: 0, errors: 0 };
  } else {
    log('success', `Skipped (${skipReason}): ${localFile}`);
    return { uploaded: 0, skipped: 1, errors: 0 };
  }
}

async function uploadDirectory(localDir, r2Prefix, description) {
  log('info', `Uploading ${description}...`);
  log('info', `Source: ${localDir}/`);
  log('info', `Destination: ${R2_BUCKET}/${r2Prefix}/`);

  const files = await getAllFiles(localDir);
  log('info', `Found ${files.length} files\n`);

  if (files.length === 0) {
    log('warning', `No files found in ${localDir}/`);
    return { uploaded: 0, skipped: 0, errors: 0 };
  }

  let uploadedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const localFile of files) {
    const relativePath = localFile.replace(localDir + '/', '');
    const r2Path = `${R2_BUCKET}/${r2Prefix}/${relativePath}`;

    if (VERBOSE) {
      log('debug', `Processing: ${relativePath}`);
    }

    try {
      let shouldUpload = true;
      let skipReason = '';

      if (!FORCE) {
        const currentChecksum = await getFileChecksum(localFile);
        const cachedChecksum = getCachedChecksum(localFile);

        if (cachedChecksum && currentChecksum === cachedChecksum) {
          shouldUpload = false;
          skipReason = 'unchanged (cached)';
        } else {
          if (VERBOSE) {
            log('debug', `Checksum changed for ${relativePath}: ${cachedChecksum || 'none'} -> ${currentChecksum}`);
          }
        }
      }

      if (shouldUpload) {
        if (DRY_RUN) {
          log('info', `Would upload: ${relativePath}`);
        } else {
          log('success', `Upload: ${relativePath}`);
          await uploadFile(localFile, r2Path);
          const currentChecksum = await getFileChecksum(localFile);
          updateCachedChecksum(localFile, currentChecksum);
        }
        uploadedCount++;
      } else {
        log('success', `Skipped (${skipReason}): ${relativePath}`);
        skippedCount++;
      }
    } catch (error) {
      log('error', `Error processing ${relativePath}: ${error.message}`);
      errorCount++;
    }
  }

  if (errorCount > 0 && VERBOSE) {
    log('warning', `${errorCount} file(s) had errors, check logs above`);
  }

  return { uploaded: uploadedCount, skipped: skippedCount, errors: errorCount };
}

async function cleanupOrphanFiles(localFiles, r2Prefix, description) {
  log('info', `Checking for orphan ${description} files in R2...`);

  const localPaths = new Set(localFiles.map(f => f.replace(/^[^/]+\//, '')));

  const remoteFiles = await getRemoteFiles(R2_BUCKET, r2Prefix);

  const orphans = remoteFiles.filter(p => {
    const relativePath = p.replace(r2Prefix + '/', '');
    return !localPaths.has(relativePath);
  });

  if (orphans.length === 0) {
    log('success', 'No orphan files found');
    return;
  }

  log('warning', `Found ${orphans.length} orphan files`);

  if (DRY_RUN) {
    for (const orphan of orphans) {
      log('info', `Would delete: ${orphan}`);
    }
    return;
  }

  let deletedCount = 0;
  for (const orphan of orphans) {
    try {
      await deleteRemoteFile(orphan);
      deletedCount++;
    } catch (error) {
      log('error', `Failed to delete ${orphan}: ${error.message}`);
    }
  }

  log('success', `Deleted ${deletedCount} orphan files`);
}

async function main() {
  if (CLEAR_CACHE) {
    clearCache();
    await saveChecksumCache();
    return;
  }

  if (DRY_RUN) {
    log('warning', 'DRY RUN MODE - No files will be uploaded');
  }
  if (FORCE) {
    log('warning', 'FORCE MODE - All files will be uploaded');
  }

  await loadChecksumCache();

  const results = [];

  console.log('');

  if (TARGET_ALL || TARGET_CONFIG) {
    const config = UPLOAD_TARGETS.config;
    const result = await uploadSingleFile(config.localPath, config.r2Path, config.description);
    results.push({ name: 'Config', ...result });
    console.log('');
  }

  if (TARGET_ALL || TARGET_THEMES) {
    const themes = UPLOAD_TARGETS.themes;
    const result = await uploadDirectory(themes.localDir, themes.r2Prefix, themes.description);
    results.push({ name: 'Themes', ...result });
    console.log('');
  }

  if (TARGET_ALL || TARGET_PUBLIC) {
    const pub = UPLOAD_TARGETS.public;
    const result = await uploadDirectory(pub.localDir, pub.r2Prefix, pub.description);
    results.push({ name: 'Public', ...result });
    console.log('');
  }

  log('info', '=== Summary ===');
  for (const r of results) {
    log('info', `${r.name} - Uploaded: ${r.uploaded}, Skipped: ${r.skipped}, Errors: ${r.errors}`);
  }

  if (CLEANUP) {
    console.log('');
    if (TARGET_ALL || TARGET_THEMES) {
      const themes = UPLOAD_TARGETS.themes;
      const allFiles = await getAllFiles(themes.localDir);
      await cleanupOrphanFiles(allFiles, themes.r2Prefix, themes.description);
    }
    if (TARGET_ALL || TARGET_PUBLIC) {
      const pub = UPLOAD_TARGETS.public;
      const allFiles = await getAllFiles(pub.localDir);
      await cleanupOrphanFiles(allFiles, pub.r2Prefix, pub.description);
    }
  }

  if (!DRY_RUN) {
    await saveChecksumCache();
  }

  const totalUploaded = results.reduce((sum, r) => sum + r.uploaded, 0);
  const status = totalUploaded > 0 ? 'uploaded' : 'sync';
  log('info', `All files ${status} complete!`);
}

main().catch((error) => {
  log('error', 'Fatal error:', error.message);
  process.exit(1);
});
