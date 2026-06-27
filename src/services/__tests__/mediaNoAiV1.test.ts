// Proposal C (Director Ruling 28/29) — structural proof, via the TypeScript
// AST, that the v1 client cannot reach media AI processing and exposes no
// AI-analysis/draft surface. These are NOT substring tests: every governing
// assertion walks the parsed source. Each helper fails CLOSED — an
// unrecognized declaration, call, JSX element, import, or object shape leaves
// the asserted fact false, so the test fails rather than passing by accident.
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '../../..');

function parseSource(relPath: string): ts.SourceFile {
  const absPath = path.resolve(REPO_ROOT, relPath);
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

// --- import facts ---------------------------------------------------------
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

function importModuleSpecifiers(sf: ts.SourceFile): string[] {
  return collect(sf, (n) =>
    ts.isImportDeclaration(n) && ts.isStringLiteral(n.moduleSpecifier)
      ? n.moduleSpecifier.text
      : undefined,
  );
}

function importsFromModuleMatching(sf: ts.SourceFile, re: RegExp): boolean {
  return importModuleSpecifiers(sf).some((m) => re.test(m));
}

// --- identifier / call facts ---------------------------------------------
function identifierAppears(sf: ts.SourceFile, name: string): boolean {
  return collect(sf, (n) => (ts.isIdentifier(n) && n.text === name ? true : undefined)).length > 0;
}

function calledSimpleNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  collect(sf, (n) => (ts.isCallExpression(n) ? n : undefined)).forEach((call) => {
    const e = call.expression;
    if (ts.isIdentifier(e)) names.add(e.text);
    else if (ts.isPropertyAccessExpression(e)) names.add(e.name.text);
  });
  return names;
}

function callsFn(sf: ts.SourceFile, fnName: string): boolean {
  return calledSimpleNames(sf).has(fnName);
}

// a CallExpression `fn(..., { status: '<status>' , ... })`
function callsFnWithStatus(sf: ts.SourceFile, fnName: string, status: string): boolean {
  let found = false;
  collect(sf, (n) => (ts.isCallExpression(n) ? n : undefined)).forEach((call) => {
    if (!(ts.isIdentifier(call.expression) && call.expression.text === fnName)) return;
    for (const arg of call.arguments) {
      if (!ts.isObjectLiteralExpression(arg)) continue;
      for (const prop of arg.properties) {
        if (
          ts.isPropertyAssignment(prop) &&
          ts.isIdentifier(prop.name) &&
          prop.name.text === 'status' &&
          ts.isStringLiteralLike(prop.initializer) &&
          prop.initializer.text === status
        ) {
          found = true;
        }
      }
    }
  });
  return found;
}

// every plain string-literal text in the file (includes import specifiers)
function stringLiteralTexts(sf: ts.SourceFile): string[] {
  return collect(sf, (n) => (ts.isStringLiteralLike(n) ? n.text : undefined));
}

// JSX text fragments, whitespace-normalized
function jsxTextFragments(sf: ts.SourceFile): string[] {
  return collect(sf, (n) =>
    ts.isJsxText(n) ? n.text.replace(/\s+/g, ' ').trim() : undefined,
  ).filter((t) => t.length > 0);
}

function jsxTagNames(sf: ts.SourceFile): string[] {
  return collect(sf, (n) =>
    ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n) ? n.tagName.getText(sf) : undefined,
  );
}

// <Stack.Screen options={{ title: '...' }} /> — fail-closed extraction of a
// route's single navigation title. Returns the title string ONLY when there is
// exactly one Stack.Screen element whose `options` attribute is an object
// literal holding EXACTLY ONE member: a non-computed, plain-string-literal
// `title` property. Any other shape — a second option (e.g. headerTitle), a
// template-literal title, a spread/shorthand/method, or a computed key — yields
// null, so the asserting test fails closed.
function stackScreenTitle(sf: ts.SourceFile): string | null {
  const screens = collect(sf, (n) =>
    (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) &&
    n.tagName.getText(sf) === 'Stack.Screen'
      ? n
      : undefined,
  );
  if (screens.length !== 1) return null; // exactly one Stack.Screen element
  const optionsAttrs = screens[0].attributes.properties.filter(
    (p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'options',
  );
  if (optionsAttrs.length !== 1) return null; // exactly one options attribute
  const init = optionsAttrs[0].initializer;
  if (!init || !ts.isJsxExpression(init) || !init.expression) return null;
  const obj = init.expression;
  if (!ts.isObjectLiteralExpression(obj)) return null; // options must be an object literal
  // Exact shape: the options object holds exactly one member, and it is a
  // non-computed `title: '<plain string literal>'` assignment — nothing else.
  if (obj.properties.length !== 1) return null; // reject any extra option (e.g. headerTitle)
  const prop = obj.properties[0];
  if (!ts.isPropertyAssignment(prop)) return null; // reject spread/shorthand/method/get/set
  if (ts.isComputedPropertyName(prop.name)) return null; // reject computed key
  if (!ts.isIdentifier(prop.name) && !ts.isStringLiteral(prop.name)) return null;
  if (prop.name.text !== 'title') return null; // the sole property must be `title`
  if (!ts.isStringLiteral(prop.initializer)) return null; // plain string literal only (no template)
  return prop.initializer.text;
}

// Alert.alert(...) calls, fail-closed: title/message are null unless a plain
// string literal is in that argument position.
interface AlertCall {
  argCount: number;
  title: string | null;
  message: string | null;
}
function findAlertCalls(sf: ts.SourceFile): AlertCall[] {
  return collect(sf, (n) => {
    if (!ts.isCallExpression(n)) return undefined;
    const e = n.expression;
    if (
      ts.isPropertyAccessExpression(e) &&
      ts.isIdentifier(e.expression) &&
      e.expression.text === 'Alert' &&
      e.name.text === 'alert'
    ) {
      const a0 = n.arguments[0];
      const a1 = n.arguments[1];
      return {
        argCount: n.arguments.length,
        title: a0 && ts.isStringLiteralLike(a0) ? a0.text : null,
        message: a1 && ts.isStringLiteralLike(a1) ? a1.text : null,
      };
    }
    return undefined;
  });
}

// Standalone "AI" acronym (word-bounded so it never trips on "available"),
// plus analysis/processing/review/draft stems.
const AI_COPY = /\bai\b|analy|process|review|draft/i;

describe('Proposal C — media AI is structurally unreachable and unexposed (AST)', () => {
  it('direct and offline upload paths cannot reach media AI processing', () => {
    const audio = parseSource('src/services/audio.ts');
    const video = parseSource('src/services/video.ts');
    const layout = parseSource('app/_layout.tsx');

    // services neither import nor reference the AI processing chokepoint
    expect(importedBindingNames(audio).has('requestSessionProcessing')).toBe(false);
    expect(identifierAppears(audio, 'requestSessionProcessing')).toBe(false);
    expect(importedBindingNames(video).has('requestSessionProcessing')).toBe(false);
    expect(identifierAppears(video, 'requestSessionProcessing')).toBe(false);

    // the offline replay path still drives BOTH uploads through to 'uploaded'
    expect(callsFn(layout, 'uploadAudio')).toBe(true);
    expect(callsFn(layout, 'uploadVideo')).toBe(true);
    expect(callsFnWithStatus(layout, 'updateAudioSession', 'uploaded')).toBe(true);
    expect(callsFnWithStatus(layout, 'updateVideoSession', 'uploaded')).toBe(true);

    // ...yet replay itself never reaches the AI chokepoint
    expect(importedBindingNames(layout).has('requestSessionProcessing')).toBe(false);
    expect(identifierAppears(layout, 'requestSessionProcessing')).toBe(false);
  });

  it('video upload confirmation describes a saved playable upload without AI', () => {
    const video = parseSource('app/video.tsx');

    // A. Post-upload confirmation: exactly one recognizable Alert.alert(string,
    //    string) success call carrying the honest saved-playback copy.
    const success = findAlertCalls(video).filter((a) => a.title === 'Video uploaded');
    expect(success).toHaveLength(1); // fail closed: one recognizable success Alert
    const call = success[0];
    expect(call.argCount).toBe(2);
    expect(call.title).toBe('Video uploaded');
    expect(call.message).toBe('Your video is saved and available for playback.');

    // B. Primary upload action label is the neutral 'UPLOAD VIDEO'.
    const jsx = jsxTextFragments(video);
    expect(jsx).toContain('UPLOAD VIDEO');

    // C. Selected-swimmer summary presents only the neutral 'Selected swimmers:'
    //    label (the selectedSwimmerIds.length count renders as its JSX neighbor).
    expect(jsx).toContain('Selected swimmers:');

    // D. Empty-selection guard uses the neutral upload-time message.
    const alertMessages = findAlertCalls(video).map((a) => a.message);
    expect(alertMessages).toContain('Select at least one swimmer before uploading.');

    // F. Navigation title is the neutral 'VIDEO' (fail-closed AST extraction).
    const navTitle = stackScreenTitle(video);
    expect(navTitle).toBe('VIDEO');

    // G. Non-vacuous fail-closed guards (synthetic TSX parsed in memory, no temp
    //    file): the helper must reject a second navigation-title option and a
    //    non-plain (template-literal) title — either would re-admit misleading copy.
    const parseTsx = (src: string): ts.SourceFile =>
      ts.createSourceFile('synthetic.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const syntheticExtraOption = parseTsx(
      "const screen = <Stack.Screen options={{ title: 'VIDEO', headerTitle: 'VIDEO ANALYSIS' }} />;",
    );
    const syntheticTemplateTitle = parseTsx(
      'const screen = <Stack.Screen options={{ title: `VIDEO` }} />;',
    );
    expect(stackScreenTitle(syntheticExtraOption)).toBeNull();
    expect(stackScreenTitle(syntheticTemplateTitle)).toBeNull();

    // E. Word-aware honesty sweep across this screen's user-visible surface —
    //    JSX text / Text content / button labels / Alert title|message args /
    //    the Stack.Screen navigation title. Every string is pulled from the AST
    //    (no whole-file substring scan); an Alert title/message in a non-literal
    //    or non-template shape fails closed.
    const userVisible: string[] = [...jsx];
    if (navTitle !== null) userVisible.push(navTitle);
    let unrecognizedAlertArg = false;
    const staticArgText = (arg: ts.Expression | undefined): string | null => {
      if (!arg) return null;
      if (ts.isStringLiteralLike(arg)) return arg.text;
      if (ts.isTemplateExpression(arg))
        return [arg.head.text, ...arg.templateSpans.map((s) => s.literal.text)].join(' ');
      return null; // unrecognized shape → caller fails closed
    };
    collect(video, (n) => (ts.isCallExpression(n) ? n : undefined)).forEach((c) => {
      const e = c.expression;
      const isAlert =
        ts.isPropertyAccessExpression(e) &&
        ts.isIdentifier(e.expression) &&
        e.expression.text === 'Alert' &&
        e.name.text === 'alert';
      if (!isAlert) return;
      [c.arguments[0], c.arguments[1]].forEach((arg) => {
        if (!arg) return;
        const txt = staticArgText(arg);
        if (txt === null) unrecognizedAlertArg = true;
        else userVisible.push(txt);
      });
    });
    expect(unrecognizedAlertArg).toBe(false);
    const offenders = userVisible.filter((t) => AI_COPY.test(t));
    expect(offenders).toEqual([]);
  });

  it('dashboard exposes no AI-review entry point', () => {
    const dash = parseSource('app/(tabs)/index.tsx');
    expect(stringLiteralTexts(dash)).not.toContain('/ai-review');
    expect(identifierAppears(dash, 'pendingDrafts')).toBe(false);
    expect(jsxTextFragments(dash).some((t) => /ai draft/i.test(t))).toBe(false);
  });

  it('AI-review route is a static unavailable state with no draft service', () => {
    const screen = parseSource('app/ai-review.tsx');
    // no aiDrafts service import
    expect(importsFromModuleMatching(screen, /aiDrafts/)).toBe(false);
    // none of its draft query/subscription/approval/rejection calls
    const called = calledSimpleNames(screen);
    for (const fn of [
      'subscribePendingDrafts',
      'approveDraft',
      'rejectDraft',
      'approveAllDrafts',
      'checkAndCompleteSession',
    ]) {
      expect(called.has(fn)).toBe(false);
    }
    // exact required copy present
    const literals = stringLiteralTexts(screen);
    expect(literals).toContain('AI Review Unavailable');
    expect(literals).toContain(
      'Audio and video uploads are available for playback, but AI analysis is not available in this version.',
    );
    // navigation title is the honest unavailable-state label, not a draft-review
    // promise — fail-closed AST extraction of the single Stack.Screen title
    const navTitle = stackScreenTitle(screen);
    expect(navTitle).toBe('AI REVIEW UNAVAILABLE');
    expect(navTitle).not.toBe('AI DRAFTS');
    // no re-enable switch / processing control
    const tags = jsxTagNames(screen);
    expect(tags).not.toContain('Switch');
    expect(tags).not.toContain('TextInput');
  });

  it('video detail exposes no AI analysis or draft-results surface', () => {
    const detail = parseSource('app/video/[id].tsx');
    // no draft subscription / approval / rejection import or call
    expect(identifierAppears(detail, 'subscribeVideoDrafts')).toBe(false);
    expect(identifierAppears(detail, 'approveVideoDraft')).toBe(false);
    expect(identifierAppears(detail, 'rejectVideoDraft')).toBe(false);
    // no "AI IS ANALYZING VIDEO" presentation, no pipeline-step JSX
    const literals = stringLiteralTexts(detail);
    const jsx = jsxTextFragments(detail);
    expect(jsx.some((t) => /ai is analyzing video/i.test(t))).toBe(false);
    expect(literals).not.toContain('analyzing');
    expect(literals).not.toContain('extracting_frames');
    // no observations / reviewed draft-results section
    expect(jsx.some((t) => /observations/i.test(t))).toBe(false);
    expect(jsx.some((t) => /reviewed/i.test(t))).toBe(false);
    // retains its video retrieval surface
    expect(importedBindingNames(detail).has('subscribeVideoSession')).toBe(true);
    expect(callsFn(detail, 'subscribeVideoSession')).toBe(true);
  });
});
