// Proposal D (Director Ruling 35) — structural proof, via the TypeScript AST
// and the filesystem, that the v1 Coach client issues no attendance-evaluation
// kick and carries no dead PROCESS_* client config. These are NOT substring
// tests: every governing assertion walks the parsed source or checks real file
// existence, and each helper fails CLOSED — an unreadable source, a parse
// diagnostic, or an unrecognized import/identifier shape leaves the asserted
// fact false, so the suite fails rather than passing by accident.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseSource(absPath: string): ts.SourceFile {
  const text = fs.readFileSync(absPath, 'utf8');
  const scriptKind = absPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  return ts.createSourceFile(
    absPath,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    scriptKind,
  );
}

// createSourceFile attaches parseDiagnostics; a syntactically broken source
// yields a non-empty list, so callers can fail closed on a bad parse.
function parseDiagnosticCount(sf: ts.SourceFile): number {
  return ((sf as unknown as { parseDiagnostics?: unknown[] }).parseDiagnostics ?? []).length;
}

function collect<T>(sf: ts.SourceFile, pick: (n: ts.Node) => T | undefined): T[] {
  const out: T[] = [];
  const walk = (n: ts.Node): void => {
    const v = pick(n);
    if (v !== undefined) out.push(v);
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}

function importModuleSpecifiers(sf: ts.SourceFile): string[] {
  return collect(sf, (n) =>
    ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
      ? n.moduleSpecifier.text
      : undefined,
  );
}

function importedBindingNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  collect(sf, (n) => (ts.isImportDeclaration(n) ? n : undefined)).forEach((imp) => {
    const clause = imp.importClause;
    if (!clause) return; // side-effect import: no bindings
    if (clause.name) names.add(clause.name.text);
    const nb = clause.namedBindings;
    if (nb && ts.isNamespaceImport(nb)) names.add(nb.name.text);
    if (nb && ts.isNamedImports(nb)) for (const el of nb.elements) names.add(el.name.text);
  });
  return names;
}

function identifierAppears(sf: ts.SourceFile, name: string): boolean {
  return collect(sf, (n) => (ts.isIdentifier(n) && n.text === name ? true : undefined)).length > 0;
}

function stringLiteralTexts(sf: ts.SourceFile): string[] {
  return collect(sf, (n) => (ts.isStringLiteralLike(n) ? n.text : undefined));
}

// Production client TypeScript/TSX under app/ and src/, excluding test sources
// (__tests__/**, *.test.*), type declarations (*.d.ts), and dependency/output
// trees. The walk reads the live tree from disk, so a re-introduced consumer
// anywhere in production source is caught.
const EXCLUDED_DIRS = new Set([
  '__tests__',
  'test',
  'node_modules',
  '.expo',
  'dist',
  'build',
  'coverage',
]);
function listProductionSources(): string[] {
  const out: string[] = [];
  const walk = (absDir: string): void => {
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const abs = path.join(absDir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
        walk(abs);
      } else if (entry.isFile()) {
        if (!/\.(ts|tsx)$/.test(entry.name)) continue;
        if (entry.name.endsWith('.d.ts')) continue;
        if (/\.test\.(ts|tsx)$/.test(entry.name)) continue;
        out.push(abs);
      }
    }
  };
  for (const root of ['app', 'src']) {
    const absRoot = path.resolve(REPO_ROOT, root);
    if (fs.existsSync(absRoot)) walk(absRoot);
  }
  return out;
}

describe('Proposal D — attendance evaluation kick is structurally absent (AST + fs)', () => {
  it('attendance service contains no evaluation-kick import or call', () => {
    const attendance = parseSource(path.resolve(REPO_ROOT, 'src/services/attendance.ts'));
    // non-vacuous: the real, non-trivial service module parsed cleanly
    expect(parseDiagnosticCount(attendance)).toBe(0);
    expect(importModuleSpecifiers(attendance).length).toBeGreaterThan(0);
    // no import of the kick module — by specifier or by bound name
    expect(importModuleSpecifiers(attendance).some((m) => /attendancePipeline/.test(m))).toBe(
      false,
    );
    expect(importedBindingNames(attendance).has('requestAttendanceEvaluation')).toBe(false);
    // no reference to or call of the kick anywhere in the module
    expect(identifierAppears(attendance, 'requestAttendanceEvaluation')).toBe(false);
  });

  it('legacy attendance pipeline and process-config modules are absent', () => {
    for (const rel of ['src/services/attendancePipeline.ts', 'src/config/functions.ts']) {
      expect(fs.existsSync(path.resolve(REPO_ROOT, rel))).toBe(false);
    }
  });

  it('client production source contains no attendance-evaluation endpoint or PROCESS config', () => {
    const files = listProductionSources();
    // non-vacuous: a real production tree that includes the de-kicked service
    expect(files.length).toBeGreaterThan(10);
    expect(files.some((f) => f.endsWith(path.join('src', 'services', 'attendance.ts')))).toBe(true);

    const offenders: string[] = [];
    for (const abs of files) {
      let sf: ts.SourceFile;
      try {
        sf = parseSource(abs);
      } catch {
        offenders.push(`${path.relative(REPO_ROOT, abs)} :: unreadable`); // fail closed
        continue;
      }
      const rel = path.relative(REPO_ROOT, abs);
      if (parseDiagnosticCount(sf) > 0) offenders.push(`${rel} :: parse diagnostics`); // fail closed
      const specs = importModuleSpecifiers(sf);
      if (specs.some((m) => /attendancePipeline/.test(m))) {
        offenders.push(`${rel} :: imports attendancePipeline`);
      }
      if (specs.some((m) => /config\/functions/.test(m))) {
        offenders.push(`${rel} :: imports config/functions`);
      }
      if (identifierAppears(sf, 'requestAttendanceEvaluation')) {
        offenders.push(`${rel} :: requestAttendanceEvaluation`);
      }
      if (identifierAppears(sf, 'PROCESS_FUNCTIONS_BASE_URL')) {
        offenders.push(`${rel} :: PROCESS_FUNCTIONS_BASE_URL`);
      }
      if (identifierAppears(sf, 'PROCESS_SHARED_SECRET')) {
        offenders.push(`${rel} :: PROCESS_SHARED_SECRET`);
      }
      if (stringLiteralTexts(sf).some((s) => /evaluateAttendanceRules/.test(s))) {
        offenders.push(`${rel} :: evaluateAttendanceRules`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
