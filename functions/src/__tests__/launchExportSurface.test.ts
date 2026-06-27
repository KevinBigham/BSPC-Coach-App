import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

const INDEX_PATH = path.join(__dirname, '..', 'index.ts');
const PERMITTED_EXPORTS = ['dailyDigest', 'sweepAttendanceEvaluations'];
const DEFERRED_EXPORTS = [
  'processAudioSession',
  'processVideoSession',
  'sweepStuckSessions',
  'evaluateAttendanceRules',
  'redeemInvite',
  'getParentPortalDashboard',
  'getParentSwimmerPortalData',
  'syncCalendar',
];

function collectRuntimeExports(source: string): string[] {
  const sourceFile = ts.createSourceFile(
    INDEX_PATH,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const exports: string[] = [];

  sourceFile.forEachChild((node) => {
    if (node.kind === ts.SyntaxKind.EndOfFileToken) {
      return;
    }

    if (ts.isExportDeclaration(node)) {
      if (node.isTypeOnly) {
        return;
      }
      if (!node.exportClause || ts.isNamespaceExport(node.exportClause)) {
        exports.push('__unsupported_runtime_export__');
        return;
      }
      for (const element of node.exportClause.elements) {
        if (!element.isTypeOnly) {
          exports.push(element.name.text);
        }
      }
      return;
    }

    exports.push('__non_export_statement__');
  });

  return Array.from(new Set(exports)).sort();
}

describe('Cloud Functions launch export surface', () => {
  const runtimeExports = collectRuntimeExports(fs.readFileSync(INDEX_PATH, 'utf8'));

  it('exports exactly the two ratified v1 schedulers', () => {
    expect(runtimeExports).toEqual([...PERMITTED_EXPORTS].sort());
  });

  it.each(DEFERRED_EXPORTS)('does not export deferred function "%s"', (name) => {
    expect(runtimeExports).not.toContain(name);
  });
});
