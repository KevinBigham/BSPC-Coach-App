import { logger } from '../logger';

// Save originals
const originalDebug = console.debug;
const originalInfo = console.info;
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.debug = jest.fn();
  console.info = jest.fn();
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.debug = originalDebug;
  console.info = originalInfo;
  console.warn = originalWarn;
  console.error = originalError;
});

describe('logger', () => {
  it('calls console.debug for debug messages in dev', () => {
    logger.debug('test debug');
    expect(console.debug).toHaveBeenCalledWith('[DEBUG]', 'test debug');
  });

  it('calls console.info for info messages', () => {
    logger.info('test info');
    expect(console.info).toHaveBeenCalledWith('[INFO]', 'test info');
  });

  it('calls console.warn for warn messages', () => {
    logger.warn('test warn');
    expect(console.warn).toHaveBeenCalledWith('[WARN]', 'test warn');
  });

  it('calls console.error for error messages', () => {
    logger.error('test error');
    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'test error');
  });

  it('includes data object when provided', () => {
    const data = { userId: '123', action: 'login' };
    logger.info('user action', data);
    expect(console.info).toHaveBeenCalledWith('[INFO]', 'user action', data);
  });

  it('does not include data when not provided', () => {
    logger.info('simple message');
    expect(console.info).toHaveBeenCalledWith('[INFO]', 'simple message');
  });
});
