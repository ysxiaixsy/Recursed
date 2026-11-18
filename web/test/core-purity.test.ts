/**
 * HANDOFF S1 acceptance: a test fails if a file in web/src/core imports phaser
 * or uses window or document. (tsconfig.core.json also has no DOM types, so
 * other browser APIs fail the type check.)
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseSync } from 'oxc-parser';
import { describe, expect, test } from 'vitest';

const CORE = fileURLToPath(new URL('../src/core', import.meta.url));
const BANNED_GLOBALS = new Set(['window', 'document']);

function isPhaser(specifier: unknown): boolean {
  return typeof specifier === 'string' && (specifier === 'phaser' || specifier.startsWith('phaser/'));
}

type Node = { type: string; [key: string]: unknown };

function isNode(value: unknown): value is Node {
  return typeof value === 'object' && value !== null && typeof (value as Node).type === 'string';
}

/** True when the identifier at parent[key] is a property name, not a variable. */
function isPropertyName(parent: Node | null, key: string): boolean {
  if (!parent || parent['computed'] === true) return false;
  switch (parent.type) {
    case 'MemberExpression':
      return key === 'property';
    case 'Property':
    case 'PropertyDefinition':
    case 'MethodDefinition':
    case 'TSPropertySignature':
    case 'TSMethodSignature':
      return key === 'key';
    default:
      return false;
  }
}

/** Every phaser import and every use of window or document in one source file. */
export function findViolations(fileName: string, source: string): string[] {
  const result = parseSync(fileName, source);
  if (result.errors.length > 0) return [`${fileName}: cannot parse: ${result.errors[0]?.message}`];
  const found: string[] = [];
  const at = (node: Node) => `${fileName}:${source.slice(0, Number(node['start'])).split('\n').length}`;

  const visit = (node: Node, parent: Node | null, key: string) => {
    switch (node.type) {
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
      case 'ImportExpression': {
        const src = node['source'];
        if (isNode(src) && isPhaser(src['value'])) found.push(`${at(node)} imports ${String(src['value'])}`);
        break;
      }
      case 'CallExpression': {
        const callee = node['callee'];
        const [first] = (node['arguments'] as unknown[]) ?? [];
        if (isNode(callee) && callee['name'] === 'require' && isNode(first) && isPhaser(first['value'])) {
          found.push(`${at(node)} requires ${String(first['value'])}`);
        }
        break;
      }
      case 'Identifier': {
        const name = node['name'];
        if (typeof name === 'string' && BANNED_GLOBALS.has(name) && !isPropertyName(parent, key)) {
          found.push(`${at(node)} uses ${name}`);
        }
        break;
      }
    }
    for (const [childKey, value] of Object.entries(node)) {
      if (Array.isArray(value)) value.forEach((v) => isNode(v) && visit(v, node, childKey));
      else if (isNode(value)) visit(value, node, childKey);
    }
  };
  visit(result.program as unknown as Node, null, '');
  return found;
}

function coreFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return coreFiles(path);
    return /\.(ts|tsx|js|mjs)$/.test(entry.name) ? [path] : [];
  });
}

describe('the purity check itself', () => {
  test.each([
    ["import Phaser from 'phaser';"],
    ["import type { Scene } from 'phaser';"],
    ["export { Scene } from 'phaser';"],
    ["export * from 'phaser/src/gameobjects';"],
    ["const p = import('phaser');"],
    ["const p = require('phaser');"],
    ['const w = window.innerWidth;'],
    ["document.title = 'x';"],
    ['type W = typeof window;'],
    ['function f(window: number) { return window; }'],
  ])('finds a violation in: %s', (source) => {
    expect(findViolations('sample.ts', source)).not.toEqual([]);
  });

  test('ignores property names, comments, strings, and other imports', () => {
    const source = [
      "import { damage } from './damage';",
      'const o = { document: 1, window: 2 };',
      'o.document = 3;',
      'type T = { window: number; document(): void };',
      'class C { document = 1; window() { return 2; } }',
      '// window and document in a comment',
      "const s = 'window' + `document`;",
    ].join('\n');
    expect(findViolations('sample.ts', source)).toEqual([]);
  });
});

test('no file in src/core imports phaser or uses window or document', () => {
  const files = coreFiles(CORE);
  expect(files.length).toBeGreaterThan(3);
  const violations = files.flatMap((file) =>
    findViolations(relative(CORE, file).replaceAll('\\', '/'), readFileSync(file, 'utf8')),
  );
  expect(violations).toEqual([]);
});
