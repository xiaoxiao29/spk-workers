/**
 * D1 数据库状态检查脚本（简化版）
 *
 * 功能：
 * - 显示表结构
 * - 显示索引信息
 * - 显示数据统计
 * - 显示迁移历史
 *
 * 说明：
 * - 本脚本提供 Wrangler CLI 没有的便捷功能
 * - 数据库创建和迁移请使用 Wrangler CLI
 *
 * 选项：
 *   --tables      显示表结构
 *   --indexes     显示索引信息
 *   --stats       显示数据统计
 *   --migrations  显示迁移状态
 *   --all         显示所有信息（默认）
 *   --json        以 JSON 格式输出
 */

import { readFile, access } from 'fs/promises';
import { spawn } from 'child_process';

const COMMAND_TIMEOUT = 30000;

const args = process.argv.slice(2);
const SHOW_TABLES = args.includes('--tables');
const SHOW_INDEXES = args.includes('--indexes');
const SHOW_STATS = args.includes('--stats');
const SHOW_MIGRATIONS = args.includes('--migrations');
const SHOW_ALL = args.includes('--all') || (!SHOW_TABLES && !SHOW_INDEXES && !SHOW_STATS && !SHOW_MIGRATIONS);
const JSON_OUTPUT = args.includes('--json');

function log(level, ...messages) {
  if (JSON_OUTPUT) return;
  
  const prefix = {
    info: 'ℹ',
    success: '✓',
    warning: '⚠',
    error: '✗',
    debug: '▸'
  };
  console.log(`${prefix[level] || ''}`, ...messages);
}

function runCommand(cmd, cmdArgs, timeout = COMMAND_TIMEOUT) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      proc.kill('SIGTERM');
      reject(new Error(`Command timed out after ${timeout}ms`));
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
        reject(new Error(`Command failed: ${stderr || stdout}`));
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

async function executeQuery(sql) {
  try {
    const output = await runCommand('npx', [
      'wrangler',
      'd1',
      'execute',
      'spks',
      '--command',
      sql,
      '--json',
      '--remote'
    ]);
    
    const lines = output.trim().split('\n').filter(line => line.trim());
    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.results) {
          return result.results;
        }
      } catch {}
    }
    return [];
  } catch (error) {
    return [];
  }
}

async function getTables() {
  const sql = `
    SELECT name, type 
    FROM sqlite_master 
    WHERE type IN ('table', 'view') 
    ORDER BY name
  `;
  return await executeQuery(sql);
}

async function getIndexes() {
  const sql = `
    SELECT name, tbl_name, sql 
    FROM sqlite_master 
    WHERE type = 'index' AND sql IS NOT NULL
    ORDER BY tbl_name, name
  `;
  return await executeQuery(sql);
}

async function getTableStats() {
  const tables = await getTables();
  const stats = [];
  
  for (const table of tables) {
    if (table.type === 'table') {
      const countSQL = `SELECT COUNT(*) as count FROM ${table.name}`;
      const result = await executeQuery(countSQL);
      stats.push({
        table: table.name,
        count: result[0]?.count || 0
      });
    }
  }
  
  return stats;
}

async function getMigrationHistory() {
  const sql = `SELECT * FROM d1_migrations ORDER BY id`;
  return await executeQuery(sql);
}

async function main() {
  const status = {
    timestamp: new Date().toISOString(),
    tables: [],
    indexes: [],
    stats: [],
    migrations: []
  };
  
  if (!JSON_OUTPUT) {
    console.log('');
    log('info', '=== D1 Database Status ===');
    console.log('');
    log('info', '提示: 使用 Wrangler CLI 管理数据库');
    log('info', '  - 创建数据库: npx wrangler d1 create spks');
    log('info', '  - 应用迁移: npx wrangler d1 migrations apply spks --remote');
    log('info', '  - 列出迁移: npx wrangler d1 migrations list spks');
    console.log('');
  }
  
  if (JSON_OUTPUT) {
    if (SHOW_ALL || SHOW_TABLES) status.tables = await getTables();
    if (SHOW_ALL || SHOW_INDEXES) status.indexes = await getIndexes();
    if (SHOW_ALL || SHOW_STATS) status.stats = await getTableStats();
    if (SHOW_ALL || SHOW_MIGRATIONS) status.migrations = await getMigrationHistory();
    
    console.log(JSON.stringify(status, null, 2));
    return;
  }
  
  if (SHOW_ALL || SHOW_TABLES) {
    log('info', 'Tables:');
    const tables = await getTables();
    status.tables = tables;
    
    if (tables.length === 0) {
      log('warning', '  No tables found');
      log('info', '  Run: npx wrangler d1 migrations apply spks --remote');
    } else {
      for (const table of tables) {
        log('info', `  - ${table.name} (${table.type})`);
      }
    }
    console.log('');
  }
  
  if (SHOW_ALL || SHOW_INDEXES) {
    log('info', 'Indexes:');
    const indexes = await getIndexes();
    status.indexes = indexes;
    
    if (indexes.length === 0) {
      log('warning', '  No indexes found');
    } else {
      for (const index of indexes) {
        log('info', `  - ${index.name} (on ${index.tbl_name})`);
      }
    }
    console.log('');
  }
  
  if (SHOW_ALL || SHOW_STATS) {
    log('info', 'Data Statistics:');
    const stats = await getTableStats();
    status.stats = stats;
    
    if (stats.length === 0) {
      log('warning', '  No data');
    } else {
      for (const stat of stats) {
        log('info', `  - ${stat.table}: ${stat.count} rows`);
      }
    }
    console.log('');
  }
  
  if (SHOW_ALL || SHOW_MIGRATIONS) {
    log('info', 'Migration History:');
    const migrations = await getMigrationHistory();
    status.migrations = migrations;
    
    if (migrations.length === 0) {
      log('warning', '  No migrations found');
      log('info', '  Run: npx wrangler d1 migrations apply spks --remote');
    } else {
      for (const migration of migrations) {
        const date = new Date(migration.applied_at).toLocaleString('zh-CN');
        log('info', `  - ${migration.name} (${date})`);
      }
    }
    console.log('');
  }
  
  log('success', 'Database status check completed');
}

main().catch((error) => {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({ error: error.message }, null, 2));
  } else {
    log('error', 'Fatal error:', error.message);
    log('info', 'Make sure database "spks" exists and you are logged in');
    log('info', 'Run: npx wrangler d1 list');
  }
  process.exit(1);
});
