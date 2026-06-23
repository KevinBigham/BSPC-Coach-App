// Proposal A — Director Rulings 09, 10 & 12: pin the Cloud Functions launch
// export surface. functions/src/index.ts must expose EXACTLY the two
// permitted runtime exports — dailyDigest and sweepAttendanceEvaluations —
// and nothing else. The eight deferred functions must not ride along into a
// deploy, and syncCalendar must not be re-added prematurely.
//
// Ruling 10 hardening — the collector is FAIL-CLOSED. It walks the
// TypeScript AST and explicitly classifies every export form. Any runtime
// export it cannot reduce to a clean public name (wildcard, `export * as ns`,
// default, `export =`), and ANY exported construct it does not explicitly
// recognize, emits a violation sentinel (prefixed `!!`) that can never equal
// a permitted name — so the exact-set pin FAILS rather than silently
// overlooking a real runtime export.
//
// Ruling 12 closes the last two gaps:
//   * Type-only is decided FIRST. `export type *`, `export type * as X`, and
//     `export default interface` carry no runtime value and are ignored —
//     never mis-flagged as violations.
//   * CommonJS export roots (`exports` / `module`) are detected RECURSIVELY,
//     anywhere in the executable AST (including nested inside an exported
//     initializer), so `exports.x = …` / `module.exports.x = …` and aliases of
//     them fail closed. The index is governed as a PURE export barrel: every
//     top-level statement is explicitly classified and any other runtime or
//     executable statement fails closed — there is no silent fall-through.
//
// Conservative stance: a re-export written WITHOUT the `type` keyword
// (`export { Foo } from './x'`) is counted as a runtime name even if Foo is
// in fact a type. That errs toward FAILING the pin (a human reviews and adds
// `type`), never toward hiding a runtime export.
import * as fs from 'fs';
import * as path from 'path';
import * as vm from 'vm';
import * as ts from 'typescript';

const INDEX_PATH = path.join(__dirname, '..', 'index.ts');

const PERMITTED = ['dailyDigest', 'sweepAttendanceEvaluations'];

const DEFERRED = [
  'processAudioSession',
  'processVideoSession',
  'sweepStuckSessions',
  'evaluateAttendanceRules',
  'redeemInvite',
  'getParentPortalDashboard',
  'getParentSwimmerPortalData',
  'syncCalendar',
];

// Violation sentinels. Each marks a runtime export the collector refuses to
// reduce to a permitted name. The leading `!!` cannot occur in a JS
// identifier, so a sentinel can never collide with a real export name.
const V = {
  wildcard: '!!wildcard-reexport',
  namespace: '!!namespace-reexport',
  default: '!!default-export',
  exportEquals: '!!export-assignment',
  commonjs: '!!commonjs-export-root',
  nonEmitting: (kind: string): string => `!!non-emitting-declare:${kind}`,
  constEnum: '!!non-emitting-const-enum',
  unrecognized: (kind: string): string => `!!unrecognized:${kind}`,
};

function isViolation(token: string): boolean {
  return token.startsWith('!!');
}

function modifiersOf(node: ts.Node): readonly ts.ModifierLike[] {
  return (ts.canHaveModifiers(node) ? ts.getModifiers(node) : undefined) ?? [];
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind): boolean {
  return modifiersOf(node).some((m) => m.kind === kind);
}

// True when `id` is an executable reference to a CommonJS export root
// (`exports` or `module`) — not a property name (`x.exports`), a type-position
// qualified name, a declared member/key, or an import/export specifier. Because
// detection works on AST identifiers, a root that appears only in a comment or
// string literal is never an Identifier node and so can never reach here.
function isCommonJsRoot(id: ts.Identifier): boolean {
  if (id.text !== 'exports' && id.text !== 'module') return false;
  const p = id.parent;
  if (!p) return true;
  if (ts.isPropertyAccessExpression(p) && p.name === id) return false; // `x.exports`
  if (ts.isQualifiedName(p) && p.right === id) return false; // type `X.exports`
  // A declared member/key literally named `exports`/`module` is inert. A
  // ShorthandPropertyAssignment is deliberately NOT in this list — `{ exports }`
  // is an executable VALUE reference (Ruling 18 A), not merely a property key.
  if (
    (ts.isPropertyAssignment(p) ||
      ts.isPropertySignature(p) ||
      ts.isPropertyDeclaration(p) ||
      ts.isMethodSignature(p) ||
      ts.isMethodDeclaration(p) ||
      ts.isEnumMember(p)) &&
    (p as { name?: ts.Node }).name === id
  ) {
    return false;
  }
  if (ts.isImportSpecifier(p) && (p.name === id || p.propertyName === id)) {
    return false; // an import binding; the import statement itself fails closed
  }
  // Runtime export specifier (Ruling 18 B). Classify the identifier by role:
  //   * propertyName is the LOCAL/source binding — `exports`/`module` here is a
  //     runtime CommonJS-root reference and must fail closed.
  //   * name is the PUBLIC exported name — a runtime root only when it is ALSO
  //     the local binding (no `propertyName` alias). `foo as exports` is just a
  //     public name; the exact-set pin rejects the unexpected name instead.
  if (ts.isExportSpecifier(p)) {
    if (p.propertyName === id) return true;
    if (p.name === id) return p.propertyName === undefined;
  }
  return true;
}

// One token per runtime export surfaced by `source`: the public name for a
// counted value export, or a `!!` sentinel for any runtime export form without
// a clean name (or any unrecognized/unclassified runtime construct). Type-only
// constructs add nothing.
function collectExportTokens(source: string, fileName = 'inspected.ts'): string[] {
  const sf = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const tokens: string[] = [];

  // (1) Fail closed on a CommonJS export root referenced ANYWHERE in the
  // executable AST — including nested inside an exported initializer. Walking
  // the AST (not the text) means comments and string literals can never be
  // mistaken for a runtime `exports`/`module` reference. Genuinely type-only
  // subtrees carry no runtime value, so the scan does NOT descend into them
  // (Ruling 18 C) — yet it still inspects class heritage, decorators, computed
  // names, initializers, function bodies, and other executable expressions.
  const isTypeOnlySubtree = (node: ts.Node): boolean =>
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeAliasDeclaration(node) ||
    (ts.isExportDeclaration(node) && node.isTypeOnly) ||
    (ts.isExportSpecifier(node) && node.isTypeOnly) ||
    (ts.isImportDeclaration(node) && !!node.importClause?.isTypeOnly) ||
    (ts.isImportSpecifier(node) && node.isTypeOnly);
  const scanCommonJs = (node: ts.Node): void => {
    if (isTypeOnlySubtree(node)) return;
    if (ts.isIdentifier(node) && isCommonJsRoot(node)) tokens.push(V.commonjs);
    ts.forEachChild(node, scanCommonJs);
  };
  ts.forEachChild(sf, scanCommonJs);

  // (2) Re-export declarations. Type-only is decided FIRST, so a type-only
  // wildcard/namespace re-export is never mis-flagged as a runtime violation.
  const handleExportDeclaration = (node: ts.ExportDeclaration): void => {
    if (node.isTypeOnly) return; // `export type { ... }`, `export type *`, `export type * as X`
    const clause = node.exportClause;
    if (!clause) {
      tokens.push(V.wildcard); // `export * from '...'`
      return;
    }
    const clauseKind = ts.SyntaxKind[clause.kind]; // captured before narrowing (fail-closed for future kinds)
    if (ts.isNamespaceExport(clause)) {
      tokens.push(V.namespace); // `export * as ns from '...'` (runtime)
      return;
    }
    if (ts.isNamedExports(clause)) {
      for (const el of clause.elements) {
        if (el.isTypeOnly) continue; // `export { type X }`
        if (el.name.text === 'default') {
          tokens.push(V.default); // `export { x as default }`
          continue;
        }
        tokens.push(el.name.text); // exported (public) name — handles `as`
      }
      return;
    }
    tokens.push(V.unrecognized(clauseKind)); // future export-clause kind — fail closed
  };

  // (3) Classify EVERY top-level statement — the index is a pure export
  // barrel, so nothing is allowed to fall through silently.
  sf.forEachChild((node) => {
    if (node.kind === ts.SyntaxKind.EndOfFileToken) return; // file terminator, not a statement
    if (ts.isExportDeclaration(node)) {
      handleExportDeclaration(node);
      return;
    }
    if (ts.isExportAssignment(node)) {
      // `export = x` (isExportEquals) vs `export default <expr>`
      tokens.push(node.isExportEquals ? V.exportEquals : V.default);
      return;
    }
    // Type-only declarations carry no runtime value — recognized BEFORE the
    // default sentinel so `export default interface J {}` (an interface with
    // export+default modifiers) is ignored rather than counted as a default.
    if (ts.isInterfaceDeclaration(node) || ts.isTypeAliasDeclaration(node)) {
      return;
    }
    if (hasModifier(node, ts.SyntaxKind.ExportKeyword)) {
      if (hasModifier(node, ts.SyntaxKind.DefaultKeyword)) {
        tokens.push(V.default); // `export default function/class ...` (named or anon)
        return;
      }
      // Ruling 18 (E): an exported `declare` is an ambient — it emits NO runtime
      // value, so it can never back a real Functions export. Fail closed before
      // any permitted name can be counted, whatever the declared value-form.
      if (hasModifier(node, ts.SyntaxKind.DeclareKeyword)) {
        tokens.push(V.nonEmitting(ts.SyntaxKind[node.kind]));
        return;
      }
      if (ts.isVariableStatement(node)) {
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) tokens.push(decl.name.text);
          else tokens.push(V.unrecognized('BindingPattern')); // destructured export
        }
        return;
      }
      if (ts.isFunctionDeclaration(node) && node.name) {
        tokens.push(node.name.text);
        return;
      }
      if (ts.isClassDeclaration(node) && node.name) {
        tokens.push(node.name.text);
        return;
      }
      if (ts.isEnumDeclaration(node)) {
        // Ruling 18 (E): a `const enum` is inlined and emits no runtime object
        // unless the compiler's preserveConstEnums mode happens to be on. The
        // launch barrel must not depend on compiler mode, so it fails closed.
        if (hasModifier(node, ts.SyntaxKind.ConstKeyword)) {
          tokens.push(V.constEnum);
          return;
        }
        tokens.push(node.name.text); // a normal enum is a runtime object
        return;
      }
      if (ts.isModuleDeclaration(node) && ts.isIdentifier(node.name)) {
        tokens.push(node.name.text); // `export namespace N { ... }` (runtime)
        return;
      }
      // exported but unrecognized construct (e.g. `export import X = require(...)`)
      tokens.push(V.unrecognized(ts.SyntaxKind[node.kind]));
      return;
    }
    // Any other top-level runtime/executable statement (a CommonJS mutation, a
    // bare call, a non-exported declaration, an import) fails closed — there is
    // NO silent return for an unclassified top-level statement.
    tokens.push(V.unrecognized(ts.SyntaxKind[node.kind]));
  });

  return tokens;
}

function normalize(tokens: string[]): string[] {
  return Array.from(new Set(tokens)).sort();
}

const indexTokens = collectExportTokens(fs.readFileSync(INDEX_PATH, 'utf8'), INDEX_PATH);

describe('Cloud Functions launch export surface (Proposal A — Director Rulings 09, 10 & 12)', () => {
  // The governing pin: the normalized runtime-export set must equal exactly
  // the two permitted names. Any deferred name, any third export, any missing
  // permitted name, or any violation sentinel breaks this.
  it('exports exactly the two permitted schedulers and nothing else', () => {
    expect(normalize(indexTokens)).toEqual([...PERMITTED].sort());
  });

  it('produces no fail-closed violation sentinel for the real index.ts', () => {
    expect(indexTokens.filter(isViolation)).toEqual([]);
  });

  it.each(PERMITTED)('still exports the permitted scheduler "%s"', (name) => {
    expect(indexTokens).toContain(name);
  });

  it.each(DEFERRED)('does not export the deferred function "%s"', (name) => {
    expect(indexTokens).not.toContain(name);
  });
});

// --- Fail-closed collector proofs on synthetic sources (Rulings 10 & 12) ----
// Synthetic snippets only — no real identifiers, paths, secrets, or data.
describe('export-surface collector is fail-closed (Director Rulings 10 & 12)', () => {
  it('counts a named re-export by its exported name', () => {
    expect(collectExportTokens("export { dailyDigest } from './a';")).toEqual(['dailyDigest']);
  });

  it('counts a renamed re-export by its public name, not its local name', () => {
    const t = collectExportTokens("export { local as dailyDigest } from './a';");
    expect(t).toContain('dailyDigest');
    expect(t).not.toContain('local');
  });

  it('counts exported variable, function, and class declarations', () => {
    const t = collectExportTokens('export const a = 1; export function b() {} export class C {}');
    expect(normalize(t)).toEqual(['C', 'a', 'b']);
  });

  it('counts an exported enum (runtime object)', () => {
    expect(collectExportTokens('export enum Color { Red }')).toContain('Color');
  });

  it('counts an exported runtime namespace', () => {
    expect(collectExportTokens('export namespace NS { export const x = 1; }')).toContain('NS');
  });

  it('FAILS (sentinel) on a wildcard re-export', () => {
    expect(collectExportTokens("export * from './a';")).toContain(V.wildcard);
  });

  it('FAILS (sentinel) on a namespace re-export', () => {
    expect(collectExportTokens("export * as ns from './a';")).toContain(V.namespace);
  });

  it.each([
    ['default expression', 'export default 42;'],
    ['anonymous default function', 'export default function () {}'],
    ['anonymous default class', 'export default class {}'],
    ['named default function', 'export default function foo() {}'],
    ['re-export as default', "export { foo as default } from './a';"],
  ])('FAILS (sentinel) on a default export (%s)', (_label, src) => {
    expect(collectExportTokens(src)).toContain(V.default);
  });

  it('FAILS (sentinel) on an `export =` assignment', () => {
    expect(collectExportTokens('const x = 1; export = x;')).toContain(V.exportEquals);
  });

  // Ruling 12 (A): type-only forms — wildcard, namespace, element-level, the
  // default interface, interfaces, and type aliases — all contribute NOTHING.
  it('ignores type-only exports, interfaces, and type aliases', () => {
    const src = [
      "export type { Foo } from './a';",
      "export { type Bar } from './b';",
      "export type * from './c';",
      "export type * as Types from './d';",
      'export interface I { x: number }',
      'export default interface J { y: number }',
      'export type T = number;',
      // Ruling 18 (A/C): type-only references to the CommonJS roots carry no
      // runtime value — type-only specifiers, element-level type-only
      // specifiers, an interface, a default interface, and a tuple type alias
      // that mention `exports`/`module` must all stay token-free.
      "export type { exports } from './e';",
      "export type { module } from './f';",
      "export { type exports } from './g';",
      "export { type module } from './h';",
      'export interface I2 { a: typeof exports; b: typeof module }',
      'export default interface J2 { z: typeof exports }',
      'export type CjsTypes = [typeof exports, typeof module];',
    ].join('\n');
    expect(collectExportTokens(src)).toEqual([]);
  });

  // Ruling 12 (B): CommonJS export roots fail closed wherever they appear,
  // including aliased and nested inside an exported initializer.
  it.each([
    ['exports.* property assignment', 'exports.extra = makeValue();'],
    ['module.exports.* property assignment', 'module.exports.extra = makeValue();'],
    ['alias originating from exports', 'const sneaky = exports;\nsneaky.leak = makeValue();'],
    [
      'CommonJS mutation nested in an exported initializer',
      'export const wrapped = (() => { exports.hidden = makeValue(); return 1; })();',
    ],
    // Ruling 18 (A): an object-shorthand `{ exports }` is an executable VALUE
    // reference, not an inert key — flagged even while the apparent public
    // export names are exactly the permitted two.
    [
      'object-shorthand reference to exports in an exported initializer',
      'export const dailyDigest = 1;\nexport const sweepAttendanceEvaluations = { exports };',
    ],
    // Ruling 18 (B): runtime export specifiers whose LOCAL/source bindings are
    // `exports`/`module` are CommonJS-root references, even though the public
    // aliases are exactly the permitted two.
    [
      'runtime export specifiers sourced from exports/module',
      'export { exports as dailyDigest, module as sweepAttendanceEvaluations };',
    ],
    // Ruling 18 (C): a runtime heritage clause referencing `exports.Base` must
    // still be detected even though genuinely type-only subtrees are pruned.
    ['exported class extending exports.Base', 'export class dailyDigest extends exports.Base {}'],
  ])('FAILS (sentinel) on a CommonJS runtime export (%s)', (_label, src) => {
    expect(collectExportTokens(src)).toContain(V.commonjs);
  });

  // Ruling 12 (B): a top-level runtime statement that is neither an export nor
  // a type-only declaration fails closed instead of being silently ignored.
  it('FAILS (sentinel) on an unclassified top-level executable statement', () => {
    const t = collectExportTokens('runSideEffectAtLoad();');
    expect(t.some(isViolation)).toBe(true);
    expect(t).toContain(V.unrecognized('ExpressionStatement'));
  });

  // Ruling 12 (C): an exported `import = require(...)` is an unrecognized
  // export construct and fails closed through the unrecognized sentinel.
  it('FAILS (sentinel) on an exported `import = require(...)`', () => {
    const t = collectExportTokens("export import Legacy = require('./synthetic');");
    expect(t.some(isViolation)).toBe(true);
    expect(t).toContain(V.unrecognized('ImportEqualsDeclaration'));
  });

  // Ruling 18 (D): inert mentions of the CommonJS roots — in comments, string
  // literals, and explicit non-computed object keys — must NOT fail closed,
  // while the public export names still normalize to exactly the permitted two.
  it('does not flag exports/module in comments, strings, or explicit property keys', () => {
    const src = [
      '// a comment mentioning exports and module.exports',
      'export const dailyDigest = "module.exports mentioned in a string literal";',
      'export const sweepAttendanceEvaluations = { exports: 1, module: 2 };',
    ].join('\n');
    const t = collectExportTokens(src);
    expect(t).not.toContain(V.commonjs);
    expect(normalize(t)).toEqual([...PERMITTED].sort());
  });

  // Ruling 18 (E): non-emitting exported declarations (`declare` ambients and
  // `const enum`s) produce NO runtime Functions export, so they must fail
  // closed and can never satisfy the runtime export pin — even when they reuse
  // the permitted names.
  it.each([
    [
      'exported `declare` ambients using the permitted names',
      'export declare const dailyDigest: number;\nexport declare function sweepAttendanceEvaluations(): void;',
    ],
    [
      'exported `const enum`s using the permitted names',
      'export const enum dailyDigest { A }\nexport const enum sweepAttendanceEvaluations { B }',
    ],
  ])(
    'FAILS (sentinel) on a non-emitting exported declaration that spoofs the permitted names (%s)',
    (_label, src) => {
      const t = collectExportTokens(src);
      expect(t.some(isViolation)).toBe(true);
      expect(normalize(t)).not.toEqual([...PERMITTED].sort());
    },
  );

  it('passes a synthetic source exporting exactly the two permitted names', () => {
    const src =
      "export { sweepAttendanceEvaluations } from './scheduled/sweepAttendanceEvaluations';\n" +
      "export { dailyDigest } from './scheduled/dailyDigest';";
    expect(normalize(collectExportTokens(src))).toEqual([...PERMITTED].sort());
  });

  it('FAILS the exact-set pin when a third (deferred) export is added', () => {
    const src =
      "export { sweepAttendanceEvaluations } from './a';\n" +
      "export { dailyDigest } from './b';\n" +
      "export { syncCalendar } from './c';";
    expect(normalize(collectExportTokens(src))).not.toEqual([...PERMITTED].sort());
    expect(collectExportTokens(src)).toContain('syncCalendar');
  });
});

// ===========================================================================
// Compiler-emitted runtime-surface pin (Director Rulings 19, 20 & 21).
//
// The collector above proves SOURCE SPELLING. It cannot, by construction, see
// that a type-only spelling of the permitted names (`interface dailyDigest {}
// … export { dailyDigest }`) emits ZERO runtime exports with ZERO compiler
// diagnostics — a false-green gap. This second, independent control proves the
// COMPILER-EMITTED RUNTIME SURFACE:
//   (A) a strict preflight gates the real index source before it is ever
//       compiled or evaluated;
//   (B) a Program built from the actual functions/tsconfig.json emits ONLY the
//       index, captured in memory (nothing is written to disk);
//   (C) the emitted CommonJS is evaluated in a hardened, null-prototype VM
//       context that injects no outer-realm value, with a context-local require
//       restricted to a validated allow-list;
//   (D) fixed synthetic sources compile through an isolated in-memory host.
// ===========================================================================

const VM_TIMEOUT_MS = 2000;
const FUNCTIONS_ROOT = path.join(__dirname, '..', '..');
const TSCONFIG_PATH = path.join(FUNCTIONS_ROOT, 'tsconfig.json');

// The only launch-permitted runtime re-exports, as name → module specifier.
const APPROVED_MAPPING: Readonly<Record<string, string>> = {
  sweepAttendanceEvaluations: './scheduled/sweepAttendanceEvaluations',
  dailyDigest: './scheduled/dailyDigest',
};
const APPROVED_SPECIFIERS: readonly string[] = Object.values(APPROVED_MAPPING);

function loadFunctionsConfig(): ts.ParsedCommandLine {
  const readResult = ts.readConfigFile(TSCONFIG_PATH, ts.sys.readFile);
  if (readResult.error) throw new Error('tsconfig read error');
  const parsed = ts.parseJsonConfigFileContent(
    readResult.config,
    ts.sys,
    path.dirname(TSCONFIG_PATH),
  );
  if (parsed.errors.length > 0) throw new Error(`tsconfig parse errors: ${parsed.errors.length}`);
  return parsed;
}

// Shared complete-Program pre-emit diagnostic gate (Director Ruling 22).
// Equivalent to ts.getPreEmitDiagnostics: options + global + syntactic +
// semantic diagnostics across the ENTIRE Program (every SourceFile), not just
// the index. Both compiler paths gate on this before any emit.
function completeProgramDiagnostics(program: ts.Program): readonly ts.Diagnostic[] {
  return ts.getPreEmitDiagnostics(program);
}

function diagnosticCodesOf(diagnostics: readonly ts.Diagnostic[]): string[] {
  return Array.from(new Set(diagnostics.map((d) => `TS${d.code}`)));
}

// (A) Strict real-index source preflight ------------------------------------
interface PreflightResult {
  ok: boolean;
  reason: string;
  mapping: Record<string, string>;
}

function preflightIndexSource(source: string): PreflightResult {
  const fail = (reason: string): PreflightResult => ({ ok: false, reason, mapping: {} });
  const sf = ts.createSourceFile(
    'index.preflight.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
  const parseDiagnostics = (sf as unknown as { parseDiagnostics?: readonly ts.Diagnostic[] })
    .parseDiagnostics;
  if (parseDiagnostics && parseDiagnostics.length > 0) return fail('parse-diagnostics');
  if (sf.statements.length !== 2) return fail(`statement-count:${sf.statements.length}`);

  const mapping: Record<string, string> = {};
  for (const stmt of sf.statements) {
    if (!ts.isExportDeclaration(stmt)) return fail('not-export-declaration');
    if (stmt.isTypeOnly) return fail('type-only-declaration');
    const clause = stmt.exportClause;
    if (!clause || !ts.isNamedExports(clause)) return fail('not-named-exports');
    if (clause.elements.length !== 1) return fail('not-single-specifier');
    const element = clause.elements[0];
    if (element.isTypeOnly) return fail('type-only-specifier');
    if (element.propertyName !== undefined) return fail('aliased-specifier');
    if (element.name.kind !== ts.SyntaxKind.Identifier) return fail('non-identifier-name');
    if (!stmt.moduleSpecifier || !ts.isStringLiteral(stmt.moduleSpecifier)) {
      return fail('no-string-module-specifier');
    }
    if (
      (stmt as unknown as { attributes?: unknown }).attributes !== undefined ||
      (stmt as unknown as { assertClause?: unknown }).assertClause !== undefined
    ) {
      return fail('import-attributes-present');
    }
    mapping[element.name.text] = stmt.moduleSpecifier.text;
  }
  return { ok: true, reason: 'ok', mapping };
}

function mappingEqualsApproved(mapping: Record<string, string>): boolean {
  const keys = Object.keys(mapping).sort();
  const approvedKeys = Object.keys(APPROVED_MAPPING).sort();
  if (keys.length !== approvedKeys.length) return false;
  if (keys.some((key, i) => key !== approvedKeys[i])) return false;
  return keys.every((key) => mapping[key] === APPROVED_MAPPING[key]);
}

// The single ordering gate: `next` runs ONLY when the strict preflight passes
// AND the name→module mapping equals the approved pair. `ran` reports whether
// `next` was invoked, so a control can prove zero evaluation of unsafe source.
function preflightThen<T>(
  source: string,
  next: () => T,
): { ran: number; preflight: PreflightResult; result?: T } {
  const preflight = preflightIndexSource(source);
  if (!preflight.ok || !mappingEqualsApproved(preflight.mapping)) {
    return { ran: 0, preflight };
  }
  return { ran: 1, preflight, result: next() };
}

// (B) Actual project configuration + in-memory emit -------------------------
interface RealIndexEmit {
  tsVersion: string;
  moduleIsCommonJs: boolean;
  diagnosticCodes: string[];
  emitSkipped: boolean;
  outputPaths: string[];
  indexJs: string;
}

function emitRealIndex(): RealIndexEmit {
  const parsed = loadFunctionsConfig();
  if (ts.version !== '5.7.3') throw new Error(`unexpected TypeScript version ${ts.version}`);
  if (parsed.options.module !== ts.ModuleKind.CommonJS) throw new Error('module is not CommonJS');
  if (parsed.options.noEmit === true) throw new Error('noEmit is true');
  if (parsed.options.emitDeclarationOnly === true) throw new Error('emitDeclarationOnly is true');

  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: parsed.options,
    projectReferences: parsed.projectReferences,
  });
  const indexSources = program
    .getSourceFiles()
    .filter((sf) => path.normalize(sf.fileName) === path.normalize(INDEX_PATH));
  if (indexSources.length !== 1)
    throw new Error(`index source located ${indexSources.length} times`);
  const indexSf = indexSources[0];

  // Complete-Program pre-emit gate (Director Ruling 22): syntactic + semantic
  // across EVERY SourceFile, not just the index. Config-file errors already
  // fail earlier in loadFunctionsConfig.
  const programDiagnostics = completeProgramDiagnostics(program);
  const programDiagnosticCodes = diagnosticCodesOf(programDiagnostics);
  if (programDiagnostics.length > 0) {
    throw new Error(`pre-emit diagnostics: ${programDiagnosticCodes.join(',')}`);
  }

  const outputs: Record<string, string> = {};
  const order: string[] = [];
  const emitResult = program.emit(indexSf, (fileName, text) => {
    const norm = path.normalize(fileName);
    if (order.includes(norm)) throw new Error(`duplicate output path: ${norm}`);
    order.push(norm);
    outputs[norm] = text;
  });
  if (emitResult.emitSkipped) throw new Error('emitSkipped');
  if (emitResult.diagnostics.length > 0) throw new Error('emit diagnostics');

  for (const out of order) {
    if (/\.d\.ts$/.test(out)) throw new Error('declaration output requested');
    if (/\.tsbuildinfo$/.test(out)) throw new Error('tsbuildinfo requested');
  }
  const jsOutputs = order.filter((p) => /\.js$/.test(p));
  if (jsOutputs.length !== 1)
    throw new Error(`expected exactly one JS output, got ${jsOutputs.length}`);

  const outDir = parsed.options.outDir ?? path.join(FUNCTIONS_ROOT, 'lib');
  const expected = [
    path.normalize(path.join(outDir, 'index.js')),
    path.normalize(path.join(outDir, 'index.js.map')),
  ].sort();
  const actual = [...order].sort();
  if (actual.length !== expected.length || actual.some((p, i) => p !== expected[i])) {
    throw new Error(`unexpected output set: ${actual.join(' | ')}`);
  }

  return {
    tsVersion: ts.version,
    moduleIsCommonJs: true,
    diagnosticCodes: programDiagnosticCodes,
    emitSkipped: emitResult.emitSkipped,
    outputPaths: order,
    indexJs: outputs[jsOutputs[0]],
  };
}

// (C) Hardened constrained CommonJS evaluator -------------------------------
interface RuntimeSurface {
  ownNames: string[];
  runtimeNames: string[];
  ledger: string[];
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function evaluateCommonJs(code: string, allowedSpecifiers: readonly string[]): RuntimeSurface {
  // Validate the allow-list OUTSIDE the VM: exactly the empty set, or exactly
  // the two approved scheduled specifiers. No other allow-list is permitted.
  const allowed = [...allowedSpecifiers].sort();
  const approved = [...APPROVED_SPECIFIERS].sort();
  const isEmpty = allowed.length === 0;
  const isApprovedPair =
    allowed.length === 2 && allowed[0] === approved[0] && allowed[1] === approved[1];
  if (!isEmpty && !isApprovedPair) throw new Error('invalid allow-list');

  // Null-prototype container with NO supplied properties. The context uses its
  // own (context-native) intrinsics; no outer-realm value is injected.
  const container = Object.create(null) as object;
  const context = vm.createContext(container, {
    name: 'launch-export-runtime-pin',
    codeGeneration: { strings: false, wasm: false },
    microtaskMode: 'afterEvaluate',
  });

  // module / exports / require / ledger / allow-set are ALL constructed inside
  // the context by this fixed setup script. `allowed` is a validated, closed
  // set of string literals embedded as JSON.
  const setupScript =
    `var __allowed = new Set(${JSON.stringify(allowed)});\n` +
    'var __seen = new Set();\n' +
    'var __ledger = [];\n' +
    'var module = Object.create(null);\n' +
    'module.exports = Object.create(null);\n' +
    'var exports = module.exports;\n' +
    'function require(specifier) {\n' +
    '  if (typeof specifier !== "string") throw new Error("non-string-require");\n' +
    '  if (!__allowed.has(specifier)) throw new Error("unknown-require:" + specifier);\n' +
    '  if (__seen.has(specifier)) throw new Error("duplicate-require:" + specifier);\n' +
    '  __seen.add(specifier);\n' +
    '  __ledger.push(specifier);\n' +
    '  return Object.create(null);\n' +
    '}\n';
  const extractScript =
    'JSON.stringify({ names: Object.getOwnPropertyNames(module.exports), requested: __ledger });';

  vm.runInContext(setupScript, context, { timeout: VM_TIMEOUT_MS, filename: 'pin.setup.js' });
  vm.runInContext(code, context, { timeout: VM_TIMEOUT_MS, filename: 'pin.emitted.js' });
  const extracted = vm.runInContext(extractScript, context, {
    timeout: VM_TIMEOUT_MS,
    filename: 'pin.extract.js',
  });
  if (typeof extracted !== 'string') throw new Error('extraction did not return a string');

  const decoded = JSON.parse(extracted) as { names: unknown; requested: unknown };
  const names = decoded.names;
  const requested = decoded.requested;
  if (!isStringArray(names) || !isStringArray(requested)) {
    throw new Error('extraction returned a non-string-array');
  }
  if (new Set(names).size !== names.length) throw new Error('duplicate own-property names');
  if (new Set(requested).size !== requested.length) throw new Error('duplicate requests');

  return {
    ownNames: names,
    runtimeNames: names.filter((name) => name !== '__esModule').sort(),
    ledger: requested,
  };
}

// (D) Isolated synthetic compiler -------------------------------------------
interface SyntheticResult {
  diagnosticCodes: string[];
  indexSyntacticCodes: string[];
  indexSemanticCodes: string[];
  emitDiagnosticCodes: string[];
  emitAttempts: number;
  emitted: boolean;
  emitSkipped: boolean;
  indexJs: string | null;
  outputBaseNames: string[];
  realNonDeclarationLeak: string[];
}

function compileSynthetic(files: Record<string, string>, indexPath: string): SyntheticResult {
  for (const virtualPath of Object.keys(files)) {
    if (fs.existsSync(virtualPath)) throw new Error(`virtual path exists on disk: ${virtualPath}`);
  }
  const options = loadFunctionsConfig().options;
  const host = ts.createCompilerHost(options);
  const baseGetSourceFile = host.getSourceFile.bind(host);
  const baseReadFile = host.readFile.bind(host);
  const baseFileExists = host.fileExists.bind(host);
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreate) =>
    files[fileName] !== undefined
      ? ts.createSourceFile(
          fileName,
          files[fileName],
          options.target ?? ts.ScriptTarget.ES2022,
          true,
        )
      : baseGetSourceFile(fileName, languageVersion, onError, shouldCreate);
  host.readFile = (fileName) =>
    files[fileName] !== undefined ? files[fileName] : baseReadFile(fileName);
  host.fileExists = (fileName) => (files[fileName] !== undefined ? true : baseFileExists(fileName));

  const outputs: Record<string, string> = {};
  const order: string[] = [];
  host.writeFile = (fileName, text) => {
    const norm = path.normalize(fileName);
    if (order.includes(norm)) throw new Error('duplicate synthetic output');
    order.push(norm);
    outputs[norm] = text;
  };

  const program = ts.createProgram({ rootNames: [indexPath], options, host });
  const realNonDeclarationLeak = program
    .getSourceFiles()
    .filter((sf) => !sf.isDeclarationFile)
    .map((sf) => sf.fileName)
    .filter((name) => files[name] === undefined && files[path.normalize(name)] === undefined);
  if (realNonDeclarationLeak.length > 0) {
    throw new Error(
      `real non-declaration source entered synthetic program: ${realNonDeclarationLeak.join(',')}`,
    );
  }

  const indexSf = program.getSourceFile(indexPath);
  if (!indexSf) throw new Error('synthetic index source missing');
  // Index-only diagnostics — collected for proof; they DO NOT replace the gate.
  const indexSyntacticCodes = diagnosticCodesOf(program.getSyntacticDiagnostics(indexSf));
  const indexSemanticCodes = diagnosticCodesOf(program.getSemanticDiagnostics(indexSf));
  // Complete-Program pre-emit gate (Director Ruling 22) via the shared helper.
  const programDiagnostics = completeProgramDiagnostics(program);
  const diagnosticCodes = diagnosticCodesOf(programDiagnostics);
  if (programDiagnostics.length > 0) {
    return {
      diagnosticCodes,
      indexSyntacticCodes,
      indexSemanticCodes,
      emitDiagnosticCodes: [],
      emitAttempts: 0,
      emitted: false,
      emitSkipped: true,
      indexJs: null,
      outputBaseNames: [],
      realNonDeclarationLeak,
    };
  }

  const emitResult = program.emit(indexSf);
  const emitDiagnosticCodes = diagnosticCodesOf(emitResult.diagnostics);
  if (emitResult.emitSkipped) throw new Error('synthetic emit skipped');
  if (emitResult.diagnostics.length > 0) {
    throw new Error(`synthetic emit diagnostics: ${emitDiagnosticCodes.join(',')}`);
  }

  const indexBase = path.basename(indexPath).replace(/\.ts$/, '.js');
  const expected = [indexBase, `${indexBase}.map`].sort();
  const actual = order.map((p) => path.basename(p)).sort();
  if (actual.length !== expected.length || actual.some((b, i) => b !== expected[i])) {
    throw new Error(`unexpected synthetic output set: ${actual.join(' | ')}`);
  }
  const indexKey = order.find((p) => path.basename(p) === indexBase);
  if (!indexKey) throw new Error('synthetic index.js not captured');

  return {
    diagnosticCodes,
    indexSyntacticCodes,
    indexSemanticCodes,
    emitDiagnosticCodes,
    emitAttempts: 1,
    emitted: true,
    emitSkipped: emitResult.emitSkipped,
    indexJs: outputs[indexKey],
    outputBaseNames: actual,
    realNonDeclarationLeak,
  };
}

const SYNTH_ROOT = loadFunctionsConfig().options.rootDir ?? path.join(FUNCTIONS_ROOT, 'src');
const synthPath = (name: string): string => path.join(SYNTH_ROOT, name);

describe('Cloud Functions launch export surface — compiler-emitted runtime pin (Director Rulings 19–21)', () => {
  // CASE 1 — real index compile contract.
  it('strict-preflights the frozen index, configures, diagnoses clean, and emits exactly index.js + index.js.map', () => {
    const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');
    const gate = preflightThen(indexSource, () => emitRealIndex());
    expect(gate.ran).toBe(1);
    expect(gate.preflight.ok).toBe(true);
    expect(mappingEqualsApproved(gate.preflight.mapping)).toBe(true);
    const emit = gate.result;
    if (!emit) throw new Error('preflight unexpectedly blocked the frozen index');
    expect(emit.tsVersion).toBe('5.7.3');
    expect(emit.moduleIsCommonJs).toBe(true);
    expect(emit.diagnosticCodes).toEqual([]);
    expect(emit.emitSkipped).toBe(false);
    expect(emit.outputPaths.map((p) => path.basename(p)).sort()).toEqual([
      'index.js',
      'index.js.map',
    ]);
  });

  // CASE 2 — real runtime surface.
  it('emits exactly the two permitted runtime exports, each required exactly once, loading no real module', () => {
    const indexSource = fs.readFileSync(INDEX_PATH, 'utf8');
    const gate = preflightThen(indexSource, () => emitRealIndex());
    expect(gate.ran).toBe(1);
    const emit = gate.result;
    if (!emit) throw new Error('preflight unexpectedly blocked the frozen index');
    const surface = evaluateCommonJs(emit.indexJs, APPROVED_SPECIFIERS);
    expect(surface.runtimeNames).toEqual([...PERMITTED].sort());
    expect([...surface.ledger].sort()).toEqual([...APPROVED_SPECIFIERS].sort());
    expect(surface.ledger.length).toBe(2);
    expect(new Set(surface.ledger).size).toBe(2);
  });

  // CASE 3 — local type-only spoof emits an empty surface (rewritten transient R1).
  it('local type-only-symbol spoof emits an empty runtime surface and fails the runtime pin', () => {
    const indexPath = synthPath('__r21_local_typeonly.ts');
    const result = compileSynthetic(
      {
        [indexPath]:
          'interface dailyDigest {}\n' +
          'interface sweepAttendanceEvaluations {}\n' +
          'export { dailyDigest, sweepAttendanceEvaluations };',
      },
      indexPath,
    );
    expect(result.diagnosticCodes).toEqual([]);
    expect(result.emitSkipped).toBe(false);
    const code = result.indexJs;
    if (code === null) throw new Error('synthetic emit produced no index.js');
    const surface = evaluateCommonJs(code, []);
    expect(surface.runtimeNames).toEqual([]);
    expect(surface.runtimeNames).not.toEqual([...PERMITTED].sort());
  });

  // CASE 4 — module type-only re-export spoof emits an empty surface (rewritten transient R2).
  it('module type-only re-export spoof emits an empty surface and empty ledger, loading no real module', () => {
    const typesPath = synthPath('__r21_types.ts');
    const indexPath = synthPath('__r21_reexport.ts');
    const result = compileSynthetic(
      {
        [typesPath]:
          'export interface dailyDigest {}\nexport interface sweepAttendanceEvaluations {}',
        [indexPath]:
          "export {\n  dailyDigest,\n  sweepAttendanceEvaluations\n} from './__r21_types';",
      },
      indexPath,
    );
    expect(result.diagnosticCodes).toEqual([]);
    expect(result.emitSkipped).toBe(false);
    expect(result.realNonDeclarationLeak).toEqual([]);
    const code = result.indexJs;
    if (code === null) throw new Error('synthetic emit produced no index.js');
    const surface = evaluateCommonJs(code, []);
    expect(surface.runtimeNames).toEqual([]);
    expect(surface.ledger).toEqual([]);
    expect(surface.runtimeNames).not.toEqual([...PERMITTED].sort());
  });

  // CASE 5 — runtime harness controls (positive, negative, hard-fail, preflight-zero).
  it('passes two runtime exports, fails a third, hard-fails a semantic error, and never evaluates unsafe index source', () => {
    // Two real runtime const exports → exactly the permitted runtime names.
    const twoPath = synthPath('__r21_two.ts');
    const two = compileSynthetic(
      { [twoPath]: 'export const dailyDigest = 1;\nexport const sweepAttendanceEvaluations = 2;' },
      twoPath,
    );
    expect(two.diagnosticCodes).toEqual([]);
    const twoCode = two.indexJs;
    if (twoCode === null) throw new Error('positive control emit produced no index.js');
    expect(evaluateCommonJs(twoCode, []).runtimeNames).toEqual([...PERMITTED].sort());

    // One unexpected third runtime export → fails the exact-set comparison.
    const threePath = synthPath('__r21_three.ts');
    const three = compileSynthetic(
      {
        [threePath]:
          'export const dailyDigest = 1;\nexport const sweepAttendanceEvaluations = 2;\nexport const syncCalendar = 3;',
      },
      threePath,
    );
    const threeCode = three.indexJs;
    if (threeCode === null) throw new Error('negative control emit produced no index.js');
    expect(evaluateCommonJs(threeCode, []).runtimeNames).not.toEqual([...PERMITTED].sort());

    // A known semantic error in a DEPENDENCY (not the index) fails the complete-
    // Program gate before any emit or evaluation — proving the shared gate covers
    // the whole Program, not just index.ts (Director Ruling 22 C). The index file
    // is itself clean and carries the two valid runtime exports.
    const depErrorPath = synthPath('__r21_dep_error.ts');
    const depIndexPath = synthPath('__r21_dep_index.ts');
    const errored = compileSynthetic(
      {
        [depErrorPath]: 'export const broken: string = 123;',
        [depIndexPath]:
          "import './__r21_dep_error';\n" +
          'export const dailyDigest = 1;\n' +
          'export const sweepAttendanceEvaluations = 2;',
      },
      depIndexPath,
    );
    expect(errored.indexSyntacticCodes).toEqual([]);
    expect(errored.indexSemanticCodes).toEqual([]);
    expect(errored.diagnosticCodes).toContain('TS2322');
    expect(errored.emitAttempts).toBe(0);
    expect(errored.emitted).toBe(false);
    expect(errored.indexJs).toBeNull();
    expect(errored.realNonDeclarationLeak).toEqual([]);

    // Unsafe executable real-index source fails strict preflight; the gated
    // callback never runs.
    let evaluations = 0;
    const gate = preflightThen(
      'export const dailyDigest = sideEffect();\nexport const sweepAttendanceEvaluations = anotherSideEffect();',
      () => {
        evaluations += 1;
        return null;
      },
    );
    expect(gate.ran).toBe(0);
    expect(gate.preflight.ok).toBe(false);
    expect(evaluations).toBe(0);
  });
});
