/**
 * AUTH-02 — every action key in the registry must have at least one
 * enforcement site in application code, or be explicitly marked reserved
 * (no feature call site exists yet). Adding a feature that uses a reserved
 * key without enforcing it makes this test fail.
 *
 * An "enforcement site" is a reference to the key string in non-registry,
 * non-test source code — the literal check `permissionService.can(id, key)`
 * or `requestApproval(key)` written next to it is what counts.
 */
import * as fs from 'fs';
import * as path from 'path';
import { ACTION_REGISTRY } from './actionRegistry';

/**
 * Keys reserved in the registry for features that have no call site yet.
 * Semantics: a reserved key must have NO references outside the registry —
 * if a feature starts using the key, the developer must remove it here and
 * wire real enforcement, making this test the tripwire.
 */
const RESERVED_KEYS = new Set([
  'discount:manual', // no manual-discount entry point exists
  'order:void', // no user-facing void action exists yet
  'order:reopen', // no user-facing reopen action exists yet
  'cash_drawer:open', // no out-of-sale drawer trigger exists yet
  'price:override', // no price-override call site exists yet
]);

const SRC_ROOTS = [
  path.resolve(__dirname, '../../features'),
  path.resolve(__dirname, '../../shared'),
  path.resolve(__dirname, '../../app'),
  path.resolve(__dirname, '../../electron'),
];

function collectSources(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') collectSources(full, out);
    } else if (/\.(ts|tsx|js)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe('AUTH-02 — registry key enforcement coverage', () => {
  const sources = SRC_ROOTS.flatMap(dir => (fs.existsSync(dir) ? collectSources(dir) : []));
  const corpus = new Map(
    sources.map(file => [
      file,
      // Strip comments so doc-mentions do not count as enforcement sites.
      fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\/\/.*/g, ''),
    ])
  );

  it('every registry key is enforced at a call site or explicitly reserved', () => {
    const unenforced: string[] = [];
    const reservedWithSites: string[] = [];
    for (const def of ACTION_REGISTRY) {
      const sites = [...corpus.entries()].filter(
        ([file, text]) => file !== path.resolve(__dirname, 'actionRegistry.ts') && text.includes(`'${def.key}'`)
      );

      if (RESERVED_KEYS.has(def.key)) {
        if (sites.length > 0) reservedWithSites.push(def.key);
      } else if (sites.length === 0) {
        unenforced.push(def.key);
      }
    }
    expect([
      ...unenforced.map(k => `${k} (no enforcement site)`),
      ...reservedWithSites.map(k => `${k} (reserved key gained call sites — enforce it)`),
    ]).toEqual([]);
  });
});
