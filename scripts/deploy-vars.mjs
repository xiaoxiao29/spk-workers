/**
 * 部署 vars 到 Cloudflare Workers
 *
 * 读取 wrangler.toml 中的 [vars] 配置，
 * 识别敏感 vars (以 _SECRET, _KEY, _PASSWORD 结尾或标记为 secret)
 * 实际部署由 deploy 命令末尾的 wrangler deploy 处理
 *
 * 用法: node scripts/deploy-vars.mjs
 */

import { readFile } from 'fs/promises';
import TOML from '@iarna/toml';

const WRANGLER_TOML_PATH = './wrangler.toml';

const SENSITIVE_PATTERNS = [
  /_SECRET$/i,
  /_KEY$/i,
  /_PASSWORD$/i,
  /_TOKEN$/i,
  /_CREDENTIAL/i,
];

function isSensitiveKey(key) {
  return SENSITIVE_PATTERNS.some(pattern => pattern.test(key));
}

async function parseWranglerToml() {
  const content = await readFile(WRANGLER_TOML_PATH, 'utf-8');
  const config = TOML.parse(content);
  return config.vars || {};
}

async function deployVars() {
  console.log('Reading vars from wrangler.toml...');

  const vars = await parseWranglerToml();
  const varKeys = Object.keys(vars);

  if (varKeys.length === 0) {
    console.log('No vars found in wrangler.toml');
    return;
  }

  console.log(`Found ${varKeys.length} vars:`);

  const sensitiveVars = [];
  const publicVars = [];

  for (const key of varKeys) {
    const value = vars[key];
    if (isSensitiveKey(key)) {
      sensitiveVars.push({ key, value });
      console.log(`  - ${key}: ***SECRET***`);
    } else {
      publicVars.push({ key, value });
      console.log(`  - ${key}: ${value}`);
    }
  }

  if (sensitiveVars.length > 0) {
    console.log('\n⚠️  Sensitive variables detected:');
    console.log('   These should be set using: wrangler secret put <NAME>');
    console.log('   Current values in wrangler.toml are NOT secure for production!');
    console.log('\n   Set secrets with:');
    for (const { key } of sensitiveVars) {
      console.log(`     wrangler secret put ${key}`);
    }
  }

  console.log('\n✅ Vars check complete. Actual deployment handled by wrangler deploy.');
}

deployVars().catch(console.error);
