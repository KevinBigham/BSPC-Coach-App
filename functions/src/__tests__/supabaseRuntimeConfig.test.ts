import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

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

describe('Supabase runtime config hardening', () => {
  it('declares Firebase params without reading values or building a client at import', () => {
    loadConfig();

    expect(mockDefineString).toHaveBeenCalledWith('SUPABASE_URL');
    expect(mockDefineSecret).toHaveBeenCalledWith('SUPABASE_SERVICE_ROLE_KEY');
    expect(mockValueFns.SUPABASE_URL).not.toHaveBeenCalled();
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it('constructs the client lazily once and binds delegated methods to it', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('https://synthetic-project.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('synthetic-runtime-credential');
    const mod = loadConfig();

    expect(mod.supabase.from('attendance')).toEqual({ table: 'attendance' });
    expect(mod.supabase.from('profiles')).toEqual({ table: 'profiles' });

    expect(mockCreateClient).toHaveBeenCalledTimes(1);
    expect(mockValueFns.SUPABASE_URL).toHaveBeenCalledTimes(1);
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).toHaveBeenCalledTimes(1);
    expect(mockCreateClient).toHaveBeenCalledWith(
      'https://synthetic-project.supabase.co',
      'synthetic-runtime-credential',
    );
    expect(mockThisHolder.value).toBe(mockClientInstance);
    expect(mockThisHolder.value).not.toBe(mod.supabase);
  });

  it('fails closed for missing and retired-placeholder configuration', () => {
    mockValueFns.SUPABASE_URL.mockReturnValue('');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('synthetic-runtime-credential');
    const missingUrl = loadConfig();
    expect(() => missingUrl.supabase.from('attendance')).toThrow(/SUPABASE_URL/);
    expect(mockValueFns.SUPABASE_SERVICE_ROLE_KEY).not.toHaveBeenCalled();
    expect(mockCreateClient).not.toHaveBeenCalled();

    jest.resetModules();
    mockCreateClient.mockClear();
    mockValueFns.SUPABASE_URL.mockReset();
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReset();
    mockValueFns.SUPABASE_URL.mockReturnValue('https://synthetic-project.supabase.co');
    mockValueFns.SUPABASE_SERVICE_ROLE_KEY.mockReturnValue('YOUR_SERVICE_ROLE_KEY');
    const placeholderSecret = loadConfig();
    expect(() => placeholderSecret.supabase.from('attendance')).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
    expect(mockCreateClient).not.toHaveBeenCalled();

    const source = fs.readFileSync(path.resolve(__dirname, '../config/supabase.ts'), 'utf8');
    expect(source).not.toContain('https://YOUR_PROJECT.supabase.co');
    expect(source).not.toContain('YOUR_SERVICE_ROLE_KEY');
  });

  it('binds the service-role secret to the two scheduled Supabase jobs', () => {
    expect(inspectScheduler('../scheduled/dailyDigest.ts', 'dailyDigest')).toEqual({
      found: true,
      firstArgIsObject: true,
      propNames: ['schedule', 'secrets'],
      schedule: 'every day 20:00',
      secretIdentifiers: ['SUPABASE_SERVICE_ROLE_KEY'],
    });
    expect(
      inspectScheduler('../scheduled/sweepAttendanceEvaluations.ts', 'sweepAttendanceEvaluations'),
    ).toEqual({
      found: true,
      firstArgIsObject: true,
      propNames: ['schedule', 'secrets'],
      schedule: 'every 5 minutes',
      secretIdentifiers: ['SUPABASE_SERVICE_ROLE_KEY'],
    });
  });
});
