/**
 * 数据导出脚本
 * 
 * 功能：
 * - 从远程 D1 数据库导出数据
 * - 生成 INSERT SQL 语句
 * - 支持导出特定表或所有表
 * 
 * 选项：
 *   --table <name>   导出指定表
 *   --all            导出所有表（默认）
 *   --output <file>  输出文件路径
 *   --format <type>  输出格式 (sql|json)
 */

import { writeFile } from 'fs/promises';
import { spawn } from 'child_process';

const COMMAND_TIMEOUT = 60000;

const args = process.argv.slice(2);
const TABLE_INDEX = args.indexOf('--table');
const TABLE_NAME = TABLE_INDEX !== -1 && args[TABLE_INDEX + 1];
const ALL_TABLES = args.includes('--all') || !TABLE_NAME;
const OUTPUT_INDEX = args.indexOf('--output');
const OUTPUT_FILE = OUTPUT_INDEX !== -1 && args[OUTPUT_INDEX + 1];
const FORMAT_INDEX = args.indexOf('--format');
const FORMAT = FORMAT_INDEX !== -1 && args[FORMAT_INDEX + 1] || 'sql';

function log(level, ...messages) {
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

async function exportTable(tableName) {
  log('info', `Exporting table: ${tableName}`);
  
  try {
    const output = await runCommand('npx', [
      'wrangler',
      'd1',
      'execute',
      'spks',
      '--command',
      `SELECT * FROM ${tableName}`,
      '--json',
      '--remote'
    ]);
    
    const lines = output.trim().split('\n').filter(line => line.trim());
    const results = [];
    
    for (const line of lines) {
      try {
        const result = JSON.parse(line);
        if (result.results && result.results.length > 0) {
          results.push(...result.results);
        }
      } catch {}
    }
    
    log('success', `Exported ${results.length} rows from ${tableName}`);
    return results;
  } catch (error) {
    log('error', `Failed to export table ${tableName}: ${error.message}`);
    return [];
  }
}

function generateInsertSQL(tableName, rows) {
  if (rows.length === 0) {
    return `-- No data in table ${tableName}\n`;
  }
  
  const columns = Object.keys(rows[0]);
  const sql = [];
  
  sql.push(`-- Data for table: ${tableName}`);
  sql.push(`-- Rows: ${rows.length}`);
  sql.push('');
  
  for (const row of rows) {
    const values = columns.map(col => {
      const value = row[col];
      if (value === null) return 'NULL';
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const escaped = value.replace(/'/g, "''");
        return `'${escaped}'`;
      }
      return `'${value}'`;
    });
    
    sql.push(
      `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});`
    );
  }
  
  sql.push('');
  return sql.join('\n');
}

function generateJSONExport(tables) {
  const exportData = {
    exported_at: new Date().toISOString(),
    tables: {}
  };
  
  for (const [tableName, rows] of Object.entries(tables)) {
    exportData.tables[tableName] = {
      count: rows.length,
      rows: rows
    };
  }
  
  return JSON.stringify(exportData, null, 2);
}

async function main() {
  console.log('');
  log('info', '=== D1 Database Export ===');
  console.log('');
  
  const tables = ALL_TABLES 
    ? ['packages', 'package_arch']
    : [TABLE_NAME];
  
  const exportData = {};
  
  for (const tableName of tables) {
    const rows = await exportTable(tableName);
    exportData[tableName] = rows;
  }
  
  console.log('');
  log('info', '=== Export Summary ===');
  
  let totalRows = 0;
  for (const [tableName, rows] of Object.entries(exportData)) {
    log('info', `  ${tableName}: ${rows.length} rows`);
    totalRows += rows.length;
  }
  
  log('info', `  Total: ${totalRows} rows`);
  console.log('');
  
  if (OUTPUT_FILE) {
    log('info', `Writing to ${OUTPUT_FILE}...`);
    
    let content;
    if (FORMAT === 'json') {
      content = generateJSONExport(exportData);
    } else {
      const sql = [];
      sql.push('-- =============================================================================');
      sql.push('-- SSPKS 数据库数据导出');
      sql.push('-- ');
      sql.push(`-- 导出时间: ${new Date().toISOString()}`);
      sql.push(`-- 总行数: ${totalRows}`);
      sql.push('-- =============================================================================');
      sql.push('');
      
      for (const [tableName, rows] of Object.entries(exportData)) {
        sql.push(generateInsertSQL(tableName, rows));
      }
      
      content = sql.join('\n');
    }
    
    await writeFile(OUTPUT_FILE, content, 'utf-8');
    log('success', `Export completed: ${OUTPUT_FILE}`);
  } else {
    if (FORMAT === 'json') {
      console.log(generateJSONExport(exportData));
    } else {
      for (const [tableName, rows] of Object.entries(exportData)) {
        console.log(generateInsertSQL(tableName, rows));
      }
    }
  }
}

main().catch((error) => {
  log('error', 'Fatal error:', error.message);
  process.exit(1);
});
