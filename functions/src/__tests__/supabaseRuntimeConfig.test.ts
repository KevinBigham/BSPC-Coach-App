import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

// Mock the Supabase SDK so no real client is built and no network is touched.
const mockThisHolder: { value: unknown } = { value: undefined };
const mockClientInstance = {
  from(this: unknown, table: string): { table: string } {
    mockThisHolder.value = this;
    return { table };
  },
};
const mockCreateClient = jest.fn((..._args: unknown[]) => mockClientInstance);
jest.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

// Mock firebase-functions/params so each parameter's .value() is controllable
// and observable. defineString/defineSecret are recorded by name.
const mockValueFns: Record<string, jest.Mock> = {
  SUPABASE_URL: jest.fn(),
  SUPABASE_SERVICE_ROLE_KEY: jest.fn(),
};
const mockDefineString = jest.fn();
const mockDefineSecret = jest.fn();
jest.mock('firebase-functions/params', () => ({
  defineString: (name: string) => {
    mockDefineString(name);
    return { name, value: mockValueFns[name] };
  },
  defineSecret: (name: string) => {
    mockDefineSecret(name);
    return { name, value: mockValueFns[name] };
  },
}));

type ConfigModule = {
  supabase: { from: (table: string) => unknown };
  SUPABASE_URL: { value: () => string };
  SUPABASE_SERVICE_ROLE_KEY: { value: () => string };
};

function loadConfig(): ConfigModule {
  return require('../config/supabase') as ConfigModule;
}

// TypeScript AST inspection of a scheduler's exact onSchedule options. The
// helper fails closed: any unrecognized shape leaves the corresponding field
// at its default so the asserting test fails rather than silently passing.
interface ScheduleBinding {
  found: boolean;
  firstArgIsObject: boolean;
  propNames: string[];
  schedule: string | null;
  secretIdentifiers: string[];
}

function inspectScheduler(relPath: string, exportName: string): ScheduleBinding {
  const abs = path.resolve(__dirname, relPath);
  const source = fs.readFileSync(abs, 'utf8');
  const sf = ts.createSourceFile(abs, source, ts.ScriptTarget.Latest, true);
  const result: ScheduleBinding = {
    found: false,
    firstArgIsObject: false,
    propNames: [],
    schedule: null,
    secretIdentifiers: [],
  };
  const visit = (node: ts.Node): void => {
    if (ts.isVariableStatement(node)) {
      const isExport = node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) ?? false;
      if (isExport) {
        for (const decl of node.declarationList.declarations) {
          if (
            ts.isIdentifier(decl.name) &&
            decl.name.text === exportName &&
            decl.initializer &&
            ts.isCallExpression(decl.initializer) &&
            ts.isIdentifier(decl.initializer.expression) &&
            decl.initializer.expression.text === 'onSchedule'
          ) {
            result.found = true;
            const firstArg = decl.initializer.arguments[0];
            if (firstArg && ts.isObjectLiteralExpression(firstArg)) {
              result.firstArgIsObject = true;
              for (const prop of firstArg.properties) {
                if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
                  result.propNames.push(prop.name.text);
                  if (prop.name.text === 'schedule' && ts.isStringLiteralLike(prop.initializer)) {
                    result.schedule = prop.initializer.text;
                  }
                  if (
                    prop.name.text === 'secrets' &&
                    ts.isArrayLiteralExpression(prop.initializer)
                  ) {
                    for (const el of prop.initializer.elements) {
                      result.secretIdentifiers.push(
                        ts.isIdentifier(el) ? el.text : '__non_identifier__',
                      );
                    }
                  }
                } else {
                  result.propNames.push('__non_property_assignment__');
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return result;
}

beforeEach(() => {
  jest.resetModules();
  mockCreateClient.mockClear();
  mockDefineString.mockClear();
  mockDefineSecret.mockClear();
  mockValueFns.SUPABASE_URL.mockReset();
  mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReset();
  mockThisHolder.value = undefined;
});

describe('Supabase runtime config hardening (Proposal B — Director Ruling 25)', () => {
  it('declares both Firebase params and constructs nothing at module import (lazy)', () => {
    loadConfig();
    expect(mockDefineString).toHaveBeenCalledWith('SUPABASE_URL');
    expect(mockDefineSecret).toHaveBeenCalledWith('SUPABASE_SERVICE_ROLE_KEY');
    expect(mockValueFns.SUPABASE_URL).not.toHaveBeenCalled();
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('constructs the client once on first use and delegates methods bound to the real client', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('https://synthetic-project.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('synthetic-service-role-key');
    const mod = loadConfig();
    const result = mod.supabase.from('attendance');
    expect(result).toEqual({ table: 'attendance' });
    expect(mockValueFns.SUPABASE_URL).toHaveBeenCalledTimes(1);
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://synthetic-project.supabase.co',
      'synthetic-service-role-key',
    );
    expect(mockThisHolder.value).toBe(mockClientInstance);
    expect(mockThisHolder.value).not.toBe(mod.supabase);
  });

  it('reuses the cached client across repeated use without re-reading config', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('https://synthetic-project.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('synthetic-service-role-key');
    const mod = loadConfig();
    mod.supabase.from('a');
    mod.supabase.from('b');
    mod.supabase.from('c');
    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockValueFns.SUPABASE_URL).toHaveBeenCalledTimes(1);
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).toHaveBeenCalledTimes(1);
    expect(mockThisHolder.value).toBe(mockClientInstance);
  });

  it('fails closed naming SUPABASE_URL when the URL is missing', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('synthetic-service-role-key');
    const mod = loadConfig();
    expect(() => mod.supabase.from('attendance')).toThrow(/SUPABASE_URL/);
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('fails closed naming SUPABASE_SERVICE_ROLE_KEY when the secret is missing', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('https://synthetic-project.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('   ');
    const mod = loadConfig();
    let captured: Error | null = null;
    try {
      mod.supabase.from('attendance');
    } catch (e) {
      captured = e as Error;
    }
    expect(captured).not.toBeNull();
    expect(captured?.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(mockValueFns.SUPABASE_URL).toHaveBeenCalledTimes(1);
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('rejects the retired placeholder values and keeps them out of the config source', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('https://YOUR_PROJECT.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('synthetic-service-role-key');
    const modA = loadConfig();
    let errA: Error | null = null;
    try {
      modA.supabase.from('x');
    } catch (e) {
      errA = e as Error;
    }
    expect(errA).not.toBeNull();
    expect(errA?.message).toContain('SUPABASE_URL');
    expect(errA?.message).not.toContain('YOUR_PROJECT');
    expect(mockCreateClient).not.toHaveBeenCalled();

    jest.resetModules();
    mockCreateClient.mockClear();
    mockValueFns.SUPABASE_URL.mockReset();
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReset();
    mockValueFns.SUPABASE_URL.mockReturnValue('https://synthetic-project.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('YOUR_SERVICE_ROLE_KEY');
    const modB = loadConfig();
    let errB: Error | null = null;
    try {
      modB.supabase.from('x');
    } catch (e) {
      errB = e as Error;
    }
    expect(errB).not.toBeNull();
    expect(errB?.message).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(errB?.message).not.toContain('YOUR_SERVICE_ROLE_KEY');
    expect(mockCreateClient).not.toHaveBeenCalled();

    const configSource = fs.readFileSync(path.resolve(__dirname, '../config/supabase.ts'), 'utf8');
    expect(configSource).not.toContain('https://YOUR_PROJECT.supabase.co');
    expect(configSource).not.toContain('YOUR_SERVICE_ROLE_KEY');
  });

  it('binds exactly SUPABASE_SERVICE_ROLE_KEY on dailyDigest with its schedule', () => {
    const b = inspectScheduler('../scheduled/dailyDigest.ts', 'dailyDigest');
    expect(b.found).toBe(true);
    expect(b.firstArgIsObject).toBe(true);
    expect(b.propNames).toEqual(['schedule', 'secrets']);
    expect(b.schedule).toBe('every day 20:00');
    expect(b.secretIdentifiers).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });

  it('binds exactly SUPABASE_SERVICE_ROLE_KEY on sweepAttendanceEvaluations with its schedule', () => {
    const b = inspectScheduler(
      '../scheduled/sweepAttendanceEvaluations.ts',
      'sweepAttendanceEvaluations',
    );
    expect(b.found).toBe(true);
    expect(b.firstArgIsObject).toBe(true);
    expect(b.propNames).toEqual(['schedule', 'secrets']);
    expect(b.schedule).toBe('every 5 minutes');
    expect(b.secretIdentifiers).toEqual(['SUPABASE_SERVICE_ROLE_KEY']);
  });
});
