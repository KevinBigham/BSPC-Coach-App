// Director Ruling 40 §14 — 8 source-safety pins over the create-only coach
// identity-remediation CLI adapter (remediate-coach.ts) and the committed
// Functions export surface, proven via the TypeScript AST + the filesystem.
// Every helper fails CLOSED: an unreadable source or an unrecognized shape
// leaves the asserted fact false, so the suite fails rather than passing by
// accident. SYNTHETIC reasoning only — no real identity, secret, or path.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '../..');
const SCRIPTS_DIR = path.resolve(__dirname, '..');

function readScript(rel: string): string {
  return fs.readFileSync(path.join(SCRIPTS_DIR, rel), 'utf8');
}

function parse(absPath: string, text: string): ts.SourceFile {
  return ts.createSourceFile(
    absPath,
    text,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TS,
  );
}

function collect<T>(root: ts.Node, pick: (node: ts.Node) => T | undefined): T[] {
  const out: T[] = [];
  const walk = (node: ts.Node): void => {
    const value = pick(node);
    if (value !== undefined) out.push(value);
    ts.forEachChild(node, walk);
  };
  walk(root);
  return out;
}

function moduleSpecifiers(sf: ts.SourceFile): string[] {
  return collect(sf, (node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      return node.moduleSpecifier.text;
    }
    if (
      ts.isExportDeclaration(node) &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      return node.moduleSpecifier.text;
    }
    return undefined;
  });
}

function processEnvKeys(sf: ts.SourceFile): string[] {
  return collect(sf, (node) => {
    if (
      ts.isPropertyAccessExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === 'process' &&
      node.expression.name.text === 'env'
    ) {
      return node.name.text;
    }
    return undefined;
  });
}

function questionArgTexts(sf: ts.SourceFile): string[] {
  return collect(sf, (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === 'question' &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      return (node.arguments[0] as ts.StringLiteralLike).text;
    }
    return undefined;
  });
}

// Value identifiers (not property-name tokens) appearing inside the arguments
// of an output sink: console.log/error, process.stdout/stderr.write, output.write.
function outputSinkValueIdentifiers(sf: ts.SourceFile): string[] {
  const sinkNames = new Set(['write', 'log', 'error']);
  const found: string[] = [];
  const walk = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      sinkNames.has(node.expression.name.text)
    ) {
      for (const arg of node.arguments) {
        const inner = (n: ts.Node): void => {
          if (
            ts.isIdentifier(n) &&
            !(ts.isPropertyAccessExpression(n.parent) && n.parent.name === n)
          ) {
            found.push(n.text);
          }
          ts.forEachChild(n, inner);
        };
        inner(arg);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sf);
  return found;
}

function exportedNames(sf: ts.SourceFile): string[] {
  const names: string[] = [];
  collect(sf, (node) => (ts.isExportDeclaration(node) ? node : undefined)).forEach((decl) => {
    if (decl.exportClause && ts.isNamedExports(decl.exportClause)) {
      for (const element of decl.exportClause.elements) names.push(element.name.text);
    }
  });
  return names;
}

// The first top-level function declaration named `name`, or null.
function findFunctionDecl(sf: ts.SourceFile, name: string): ts.FunctionDeclaration | null {
  const found = collect(sf, (node) =>
    ts.isFunctionDeclaration(node) && node.name?.text === name ? node : undefined,
  );
  return found[0] ?? null;
}

// Every CallExpression within `root` whose callee is the bare identifier `fnName`.
function callsTo(root: ts.Node, fnName: string): ts.CallExpression[] {
  return collect(root, (node) =>
    ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === fnName
      ? node
      : undefined,
  );
}

// All named-import binding identifiers across the file.
function importedNames(sf: ts.SourceFile): string[] {
  const out: string[] = [];
  collect(sf, (node) => (ts.isImportDeclaration(node) ? node : undefined)).forEach((decl) => {
    const named = decl.importClause?.namedBindings;
    if (named && ts.isNamedImports(named)) {
      for (const el of named.elements) out.push(el.name.text);
    }
  });
  return out;
}

// The object-literal member named `name`, or undefined.
function objectProp(
  obj: ts.ObjectLiteralExpression,
  name: string,
): ts.ObjectLiteralElementLike | undefined {
  return obj.properties.find((p) => !!p.name && ts.isIdentifier(p.name) && p.name.text === name);
}

function functionText(sf: ts.SourceFile, src: string, name: string): string | null {
  const found = collect(sf, (node) =>
    ts.isFunctionDeclaration(node) && node.name && node.name.text === name ? node : undefined,
  );
  return found.length > 0 ? src.slice(found[0].getStart(sf), found[0].getEnd()) : null;
}

function propertyText(sf: ts.SourceFile, src: string, name: string): string | null {
  const found = collect(sf, (node) =>
    ts.isPropertyAssignment(node) && ts.isIdentifier(node.name) && node.name.text === name
      ? node
      : undefined,
  );
  return found.length > 0 ? src.slice(found[0].getStart(sf), found[0].getEnd()) : null;
}

const ADAPTER = 'remediate-coach.ts';

describe('remediate-coach.ts — CLI source safety (Director Ruling 40 §10C)', () => {
  it('CLI uses only FIREBASE_ADMIN_KEY_PATH and exposes no credential or identity input through argv or another environment variable', () => {
    const src = readScript(ADAPTER);
    const sf = parse(ADAPTER, src);
    expect(processEnvKeys(sf)).toEqual(['FIREBASE_ADMIN_KEY_PATH']);
    expect(/process\.argv\[/.test(src)).toBe(false);
    expect(/process\.argv\.slice\(2\)/.test(src)).toBe(true);

    // (Director Ruling 43 §3/§4.E) Non-vacuous AST proof that the dedicated
    // Admin app targets exactly the gated, validated project. Every assertion
    // below is satisfied only by the relevant AST nodes — never by a comment or
    // a string literal elsewhere in the file.

    // 1) Neither getApp nor getApps is imported or called anywhere.
    for (const banned of ['getApp', 'getApps']) {
      expect(importedNames(sf)).not.toContain(banned);
      expect(callsTo(sf, banned)).toHaveLength(0);
    }

    // 2) initAdmin() contains exactly one initializeApp() call.
    const initAdmin = findFunctionDecl(sf, 'initAdmin');
    expect(initAdmin).not.toBeNull();
    const initCalls = callsTo(initAdmin as ts.Node, 'initializeApp');
    expect(initCalls).toHaveLength(1);
    const initCall = initCalls[0];

    // 3) it has exactly two arguments.
    expect(initCall.arguments).toHaveLength(2);

    // 4) argument one is an object literal containing credential: cert(...) and
    //    projectId: projectId (or the equivalent `projectId` shorthand).
    const arg0 = initCall.arguments[0];
    expect(ts.isObjectLiteralExpression(arg0)).toBe(true);
    const objArg = arg0 as ts.ObjectLiteralExpression;
    const credential = objectProp(objArg, 'credential');
    expect(
      !!credential &&
        ts.isPropertyAssignment(credential) &&
        ts.isCallExpression(credential.initializer) &&
        ts.isIdentifier(credential.initializer.expression) &&
        credential.initializer.expression.text === 'cert',
    ).toBe(true);
    const projectIdProp = objectProp(objArg, 'projectId');
    expect(
      !!projectIdProp &&
        (ts.isShorthandPropertyAssignment(projectIdProp) ||
          (ts.isPropertyAssignment(projectIdProp) &&
            ts.isIdentifier(projectIdProp.initializer) &&
            projectIdProp.initializer.text === 'projectId')),
    ).toBe(true);

    // 5) argument two is exactly the REMEDIATION_APP_NAME identifier.
    const arg1 = initCall.arguments[1];
    expect(ts.isIdentifier(arg1) && (arg1 as ts.Identifier).text === 'REMEDIATION_APP_NAME').toBe(
      true,
    );

    // 6) projectId is initialized from serviceAccount.project_id.
    const projectIdDecls = collect(initAdmin as ts.Node, (node) =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'projectId'
        ? node
        : undefined,
    );
    expect(projectIdDecls).toHaveLength(1);
    const projInit = projectIdDecls[0].initializer;
    expect(
      !!projInit &&
        ts.isPropertyAccessExpression(projInit) &&
        ts.isIdentifier(projInit.expression) &&
        projInit.expression.text === 'serviceAccount' &&
        projInit.name.text === 'project_id',
    ).toBe(true);

    // 7) a runtime guard inside initAdmin() requires serviceAccount.project_id
    //    to be a string and rejects its trimmed-empty form BEFORE initializeApp.
    const guards = collect(initAdmin as ts.Node, (node) =>
      ts.isIfStatement(node) ? node : undefined,
    );
    const projectIdGuard = guards.find((g) => {
      const throwsInThen =
        collect(g.thenStatement, (n) => (ts.isThrowStatement(n) ? n : undefined)).length > 0;
      if (!throwsInThen) return false;
      const typeofOnProjectId =
        collect(g.expression, (n) =>
          ts.isTypeOfExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          ts.isIdentifier(n.expression.expression) &&
          n.expression.expression.text === 'serviceAccount' &&
          n.expression.name.text === 'project_id'
            ? n
            : undefined,
        ).length > 0;
      const trimsProjectId =
        collect(g.expression, (n) =>
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'trim' &&
          ts.isPropertyAccessExpression(n.expression.expression) &&
          ts.isIdentifier(n.expression.expression.expression) &&
          n.expression.expression.expression.text === 'serviceAccount' &&
          n.expression.expression.name.text === 'project_id'
            ? n
            : undefined,
        ).length > 0;
      return typeofOnProjectId && trimsProjectId;
    });
    expect(projectIdGuard).toBeDefined();
    expect((projectIdGuard as ts.IfStatement).getEnd()).toBeLessThan(initCall.getStart(sf));

    // 8) initAdmin() returns exactly the same app and projectId identifiers.
    const returnObjs = collect(initAdmin as ts.Node, (node) =>
      ts.isReturnStatement(node) && node.expression && ts.isObjectLiteralExpression(node.expression)
        ? (node.expression as ts.ObjectLiteralExpression)
        : undefined,
    );
    expect(returnObjs).toHaveLength(1);
    const returnedNames = returnObjs[0].properties.map((p) =>
      p.name && ts.isIdentifier(p.name) ? p.name.text : '<NOT_IDENTIFIER>',
    );
    expect(returnedNames.slice().sort()).toEqual(['app', 'projectId']);

    // 9) main() passes those identifiers to buildPorts(app, projectId).
    const mainDecl = findFunctionDecl(sf, 'main');
    expect(mainDecl).not.toBeNull();
    const buildPortsCalls = callsTo(mainDecl as ts.Node, 'buildPorts');
    expect(buildPortsCalls).toHaveLength(1);
    const bpArgs = buildPortsCalls[0].arguments;
    expect(bpArgs).toHaveLength(2);
    expect(ts.isIdentifier(bpArgs[0]) && (bpArgs[0] as ts.Identifier).text === 'app').toBe(true);
    expect(ts.isIdentifier(bpArgs[1]) && (bpArgs[1] as ts.Identifier).text === 'projectId').toBe(
      true,
    );

    // 10) every getAuth() and getFirestore() call takes exactly one argument,
    //     the identifier `app` — never an ambient/default client.
    for (const fnName of ['getAuth', 'getFirestore']) {
      const calls = callsTo(sf, fnName);
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call.arguments).toHaveLength(1);
        expect(
          ts.isIdentifier(call.arguments[0]) && (call.arguments[0] as ts.Identifier).text === 'app',
        ).toBe(true);
      }
    }

    // (Director Ruling 45 §3 case 39) Exact, AST-node-level proofs — satisfied
    // ONLY by the relevant nodes, never by text searches, comments, or unrelated
    // literals.
    const isProjectIdAccess = (n: ts.Node): boolean =>
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === 'serviceAccount' &&
      n.name.text === 'project_id';

    // (i) the guard condition is EXACTLY equivalent to
    //     typeof serviceAccount.project_id !== 'string' || serviceAccount.project_id.trim() === ''
    const guardCond = (projectIdGuard as ts.IfStatement).expression;
    expect(
      ts.isBinaryExpression(guardCond) &&
        guardCond.operatorToken.kind === ts.SyntaxKind.BarBarToken,
    ).toBe(true);
    const guardBin = guardCond as ts.BinaryExpression;
    const gLeft = guardBin.left;
    expect(
      ts.isBinaryExpression(gLeft) &&
        gLeft.operatorToken.kind === ts.SyntaxKind.ExclamationEqualsEqualsToken &&
        ts.isTypeOfExpression(gLeft.left) &&
        isProjectIdAccess(gLeft.left.expression) &&
        ts.isStringLiteral(gLeft.right) &&
        gLeft.right.text === 'string',
    ).toBe(true);
    const gRight = guardBin.right;
    expect(
      ts.isBinaryExpression(gRight) &&
        gRight.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
        ts.isCallExpression(gRight.left) &&
        gRight.left.arguments.length === 0 &&
        ts.isPropertyAccessExpression(gRight.left.expression) &&
        gRight.left.expression.name.text === 'trim' &&
        isProjectIdAccess(gRight.left.expression.expression) &&
        ts.isStringLiteral(gRight.right) &&
        gRight.right.text === '',
    ).toBe(true);

    // (ii) the guard's throwing branch precedes the initializeApp() call.
    expect((projectIdGuard as ts.IfStatement).getEnd()).toBeLessThan(initCall.getStart(sf));

    // (iii) credential is cert(...) whose argument, after unwrapping `as` /
    //       parentheses / non-null, is EXACTLY the identifier `serviceAccount`.
    const unwrap = (node: ts.Expression): ts.Expression => {
      let n: ts.Expression = node;
      while (
        ts.isAsExpression(n) ||
        ts.isParenthesizedExpression(n) ||
        ts.isNonNullExpression(n) ||
        ts.isTypeAssertionExpression(n)
      ) {
        n = n.expression;
      }
      return n;
    };
    const certCall = (credential as ts.PropertyAssignment).initializer as ts.CallExpression;
    expect(certCall.arguments.length).toBeGreaterThanOrEqual(1);
    const certArg = unwrap(certCall.arguments[0]);
    expect(ts.isIdentifier(certArg) && (certArg as ts.Identifier).text === 'serviceAccount').toBe(
      true,
    );

    // (iv) the `app` variable receives the SOLE initializeApp(...) result node.
    const appDecls = collect(initAdmin as ts.Node, (node) =>
      ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'app'
        ? node
        : undefined,
    );
    expect(appDecls).toHaveLength(1);
    expect(appDecls[0].initializer).toBe(initCall);

    // (v) initAdmin() returns the IDENTIFIERS app and projectId (shorthand, or
    //     `app: app` / `projectId: projectId`) — not unrelated same-named props.
    const identifierValued = (p: ts.ObjectLiteralElementLike | undefined, name: string): boolean =>
      !!p &&
      (ts.isShorthandPropertyAssignment(p) ||
        (ts.isPropertyAssignment(p) &&
          ts.isIdentifier(p.initializer) &&
          p.initializer.text === name));
    expect(identifierValued(objectProp(returnObjs[0], 'app'), 'app')).toBe(true);
    expect(identifierValued(objectProp(returnObjs[0], 'projectId'), 'projectId')).toBe(true);

    // (vi) main() destructures app and projectId from the SOLE initAdmin() call.
    const initAdminCalls = callsTo(mainDecl as ts.Node, 'initAdmin');
    expect(initAdminCalls).toHaveLength(1);
    const destructures = collect(mainDecl as ts.Node, (node) =>
      ts.isVariableDeclaration(node) &&
      ts.isObjectBindingPattern(node.name) &&
      node.initializer === initAdminCalls[0]
        ? node
        : undefined,
    );
    expect(destructures).toHaveLength(1);
    const bound = (destructures[0].name as ts.ObjectBindingPattern).elements.map((e) =>
      ts.isIdentifier(e.name) ? e.name.text : '<NOT_IDENTIFIER>',
    );
    expect(bound.slice().sort()).toEqual(['app', 'projectId']);
  });

  it('hidden email prompt requires TTY suppresses echo restores terminal state in finally and contains no name prompt or persistence path', () => {
    const src = readScript(ADAPTER);
    const sf = parse(ADAPTER, src);
    expect(/isTTY/.test(src)).toBe(true);
    expect(/_writeToOutput|muted/.test(src)).toBe(true);
    expect(/finally\s*\{/.test(src)).toBe(true);
    for (const text of questionArgTexts(sf)) expect(/name/i.test(text)).toBe(false);
    expect(/writeFileSync|appendFileSync|createWriteStream|writeFile\b/.test(src)).toBe(false);
    // (Director Ruling 41 §3.G) each Gate R/W prompt requires interactive TTY
    // and accepts the EXACT token 'go' — no trim, lowercase, or normalization.
    const gateFn = functionText(sf, src, 'gatePrompt');
    expect(gateFn).not.toBeNull();
    expect(/isTTY/.test(gateFn as string)).toBe(true);
    expect(/===\s*'go'/.test(gateFn as string)).toBe(true);
    expect(/\.trim\(\)/.test(gateFn as string)).toBe(false);
    expect(/\.toLowerCase\(\)/.test(gateFn as string)).toBe(false);
  });

  it('CLI accepts only no args or --execute and rejects sensitive or extra argv', () => {
    const src = readScript(ADAPTER);
    expect(/runRemediation\(\s*ports\s*,\s*process\.argv\.slice\(2\)\s*\)/.test(src)).toBe(true);
    expect(/process\.argv\[/.test(src)).toBe(false);
    expect(/parseMode/.test(readScript('remediate-coach-runner.ts'))).toBe(true);
  });

  it('CLI uses DocumentReference.create and contains no set update merge transaction-write batch-write or delete path', () => {
    const src = readScript(ADAPTER);
    expect(/\.create\(/.test(src)).toBe(true);
    for (const forbidden of [
      /\.set\(/,
      /\.update\(/,
      /\.merge\b/,
      /merge\s*:/,
      /runTransaction/,
      /\.batch\(/,
      /writeBatch/,
      /\.delete\(/,
      /deleteDoc/,
    ]) {
      expect(forbidden.test(src)).toBe(false);
    }
  });

  it('CLI uses getUserByEmail and contains no Firebase Auth user creation or Supabase identity creation', () => {
    const src = readScript(ADAPTER);
    const sf = parse(ADAPTER, src);
    expect(/getUserByEmail/.test(src)).toBe(true);
    for (const forbidden of [
      /createUser\b/,
      /createUserWithEmailAndPassword/,
      /updateUser\b/,
      /supabase/i,
      /createClient\b/,
      /@supabase/,
    ]) {
      expect(forbidden.test(src)).toBe(false);
    }
    // (Director Ruling 41 §3.D) the coach-email scan hands RAW field values to
    // the pure classifier — no String(), trim, lowercase, or fallback-to-empty
    // coercion that could mask a missing or malformed email.
    const listFn = propertyText(sf, src, 'listCoachEmails');
    expect(listFn).not.toBeNull();
    expect(/String\(/.test(listFn as string)).toBe(false);
    expect(/\?\?\s*''/.test(listFn as string)).toBe(false);
    expect(/\.trim\(\)/.test(listFn as string)).toBe(false);
    expect(/\.toLowerCase\(\)/.test(listFn as string)).toBe(false);
  });

  it('CLI imports no create-coach seed provision backfill Supabase or shipping application module', () => {
    const sf = parse(ADAPTER, readScript(ADAPTER));
    const specs = moduleSpecifiers(sf);
    for (const spec of specs) {
      expect(
        /create-coach|seed-|provision-|backfill-|@supabase|\.\.\/src\/|\.\.\/app\//.test(spec),
      ).toBe(false);
    }
    expect(specs).toEqual(
      expect.arrayContaining(['./remediate-coach-runner', './remediate-coach-plan']),
    );
  });

  it('output paths cannot receive raw UID email displayName credential path SDK error object or payload and project gates expose project_id only', () => {
    const src = readScript(ADAPTER);
    const sf = parse(ADAPTER, src);
    const denylist = new Set([
      'uid',
      'email',
      'displayName',
      'payload',
      'serviceAccount',
      'keyPath',
      'user',
      'data',
      'fullName',
      'err',
      'error',
      'record',
      'lookupEmail',
    ]);
    const offenders = outputSinkValueIdentifiers(sf).filter((name) => denylist.has(name));
    expect(offenders).toEqual([]);
    // (Director Ruling 41 §3.E) the generic catch is truthful: it never claims
    // or implies nothing was written, propagates no arbitrary error, and states
    // only that no deletion occurred — using a static unknown-state category.
    expect(/nothing was written/i.test(src)).toBe(false);
    expect(/write state was not inferred/i.test(src)).toBe(true);
    expect(/nothing was deleted/i.test(src)).toBe(true);
    expect(/\.catch\(\s*\(\s*\)\s*=>/.test(src)).toBe(true);
  });

  it('the committed Functions export surface contains no coaches-create trigger or remediation export', () => {
    const indexPath = path.resolve(REPO_ROOT, 'functions/src/index.ts');
    const src = fs.readFileSync(indexPath, 'utf8');
    const sf = parse(indexPath, src);
    const exported = exportedNames(sf);
    expect(exported.slice().sort()).toEqual(['dailyDigest', 'sweepAttendanceEvaluations']);
    for (const name of exported) expect(/remediat|coaches/i.test(name)).toBe(false);
    for (const spec of moduleSpecifiers(sf)) expect(/remediat|coaches/i.test(spec)).toBe(false);
  });
});
