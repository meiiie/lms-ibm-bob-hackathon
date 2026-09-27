import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import ts from 'typescript';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = join(projectRoot, 'src', 'app');
const outputPath = join(projectRoot, '.legacy-ui-source.json');
const vietnamese = /[ÀÁẠẢÃÂẦẤẬẨẪĂẰẮẶẲẴÈÉẸẺẼÊỀẾỆỂỄÌÍỊỈĨÒÓỌỎÕÔỒỐỘỔỖƠỜỚỢỞỠÙÚỤỦŨƯỪỨỰỬỮỲÝỴỶỸĐàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/;
const phrases = new Map();

for (const file of walk(sourceRoot)) {
  if (/\.(?:spec|test)\.ts$/.test(file)) continue;
  const extension = extname(file);
  if (extension !== '.html' && extension !== '.ts') continue;

  const source = readFileSync(file, 'utf8');
  if (extension === '.html') collectHtml(source, file);
  if (extension === '.ts') {
    collectTypeScriptStrings(source, file);
    for (const match of source.matchAll(/template\s*:\s*`([^]*?)`/g)) collectHtml(match[1], file);
  }
}

const output = Object.fromEntries(
  [...phrases.entries()]
    .sort(([left], [right]) => left.localeCompare(right, 'vi'))
    .map(([phrase, files]) => [phrase, [...files].sort()]),
);
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`Extracted ${phrases.size} Vietnamese UI literals to ${relative(projectRoot, outputPath)}`);

function collectHtml(input, file) {
  const html = input
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(?:style|script)[^>]*>[\s\S]*?<\/(?:style|script)>/gi, ' ');

  for (const match of html.matchAll(/>([^<>]+)</g)) {
    if (match[1].includes('{{')) addPattern(match[1], file);
    const withoutBindings = match[1].replace(/\{\{[\s\S]*?\}\}/g, ' ');
    add(withoutBindings, file);
  }

  for (const match of html.matchAll(/(?:aria-label|alt|placeholder|title)\s*=\s*(["'])(.*?)\1/gi)) {
    if (!match[2].includes('{{')) add(match[2], file);
  }
}

function collectTypeScriptStrings(source, file) {
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  visit(sourceFile);

  function visit(node) {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const property = ts.isPropertyAssignment(node.parent) ? node.parent.name : undefined;
      const isInlineTemplate = property && ts.isIdentifier(property) && property.text === 'template';
      if (!isInlineTemplate) add(node.text, file);
    }
    if (ts.isTemplateExpression(node)) {
      let pattern = node.head.text;
      node.templateSpans.forEach((span, index) => {
        pattern += `__NEKO_${index}__${span.literal.text}`;
      });
      add(pattern, file);
    }
    ts.forEachChild(node, visit);
  }
}

function addPattern(raw, file) {
  let index = 0;
  add(raw.replace(/\{\{[\s\S]*?\}\}/g, () => `__NEKO_${index++}__`), file);
}

function add(raw, file) {
  const phrase = raw
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&middot;/gi, '·')
    .replace(/&larr;/gi, '←')
    .replace(/&rarr;/gi, '→')
    .replace(/&times;/gi, '×')
    .replace(/&hellip;/gi, '…')
    .replace(/\\n/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!phrase || phrase.length > 300 || !vietnamese.test(phrase)) return;
  if (/^(?:https?:|\/|\.\/|\.\.\/)/i.test(phrase)) return;
  if (/^[,.:?"'}]/.test(phrase) || /"\s+(?:alt|class|loading|src)=/i.test(phrase)) return;
  if (
    /[{}][^.!?]*[{}]/.test(phrase) ||
    /<(?:div|span|p|button|input)\b/i.test(phrase) ||
    /(?:@if|@for|=>|\b(?:const|return|this)\.|\);|\}\s*else\b)/.test(phrase)
  ) return;

  const files = phrases.get(phrase) ?? new Set();
  files.add(relative(projectRoot, file).replaceAll('\\', '/'));
  phrases.set(phrase, files);
}

function* walk(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else yield path;
  }
}
