/**
 * 构建脚本
 *
 * 在构建前将 Mustache 模板嵌入到 TypeScript 代码中
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const TEMPLATES_DIR = join(ROOT_DIR, 'templates');
const PARTIALS_DIR = join(TEMPLATES_DIR, 'partials');
const OUTPUT_FILE = join(ROOT_DIR, 'src', 'output', 'templates.ts');

function escapeString(str) {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\${/g, '\\${');
}

function loadTemplate(name) {
  const path = join(TEMPLATES_DIR, `${name}.mustache`);
  const content = readFileSync(path, 'utf-8');
  return `export const ${name} = \`${escapeString(content)}\`;`;
}

function loadPartials() {
  const partials = [];
  const files = readdirSync(PARTIALS_DIR);

  for (const file of files) {
    if (file.endsWith('.mustache')) {
      const name = file.replace('.mustache', '');
      const path = join(PARTIALS_DIR, file);
      const content = readFileSync(path, 'utf-8');
      partials.push(`  "${name}": \`${escapeString(content)}\``);
    }
  }

  return `export const partials = {\n${partials.join(',\n')}\n};`;
}

function main() {
  console.log('Embedding templates...');

  const templateFiles = readdirSync(TEMPLATES_DIR)
    .filter(f => f.endsWith('.mustache'))
    .map(f => f.replace('.mustache', ''));

  const templateExports = templateFiles.map(loadTemplate).join('\n\n');
  const partialsExport = loadPartials();

  const output = `/**
 * 自动生成的模板文件
 * 由 build.ts 脚本在构建时生成
 */

${templateExports}

${partialsExport}
`;

  writeFileSync(OUTPUT_FILE, output, 'utf-8');
  console.log(`Generated: ${OUTPUT_FILE}`);
  console.log(`Templates: ${templateFiles.length}`);
}

main();
