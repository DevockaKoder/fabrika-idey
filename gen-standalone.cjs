// Вспомогательный скрипт: перегенерирует src/utils/generateStandaloneHtml.ts
// из public/standalone.html с корректным экранированием для TS-шаблонной строки.
// Запуск: node gen-standalone.cjs
const fs = require('fs');

let html = fs.readFileSync('public/standalone.html', 'utf8');

const escaped = html
  .replace(/\\/g, '\\\\')
  .replace(/`/g, '\\`')
  .replace(/\$\{/g, '\\${');

const header =
  '/* Автогенерируется из public/standalone.html командой: node gen-standalone.cjs */\n' +
  '/* Не редактируйте вручную — правьте standalone.html и перегенерируйте. */\n\n' +
  'export function getStandaloneHtmlContent(): string {\n' +
  '  return `' + escaped + '`;\n' +
  '}\n';

fs.writeFileSync('src/utils/generateStandaloneHtml.ts', header);
console.log('generateStandaloneHtml.ts written:', header.length, 'chars');
