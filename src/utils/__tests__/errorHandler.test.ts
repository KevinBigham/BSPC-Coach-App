import { setGlobalToast, handleError } from '../errorHandler';

describe('setGlobalToast', () => {
  afterEach(() => {
    setGlobalToast(null);
  });

  it('sets the global toast function', () => {
    const mockToast = jest.fn();
    setGlobalToast(mockToast);
    // Verify it works by triggering handleError
    handleError(new Error('test'));
    expect(mockToast).toHaveBeenCalled();
  });
});

describe('handleError', () => {
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    setGlobalToast(null);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  it('logs Error message to console', () => {
    handleError(new Error('something broke'));
    expect(consoleSpy).toHaveBeenCalledWith('something broke');
  });

  it('logs with context prefix when provided', () => {
    handleError(new Error('fail'), 'LoadData');
    expect(consoleSpy).toHaveBeenCalledWith('[LoadData] fail');
  });

  it('converts non-Error values to strings', () => {
    handleError('raw string error');
    expect(consoleSpy).toHaveBeenCalledWith('raw string error');
  });

  it('converts number errors to strings', () => {
    handleError(404);
    expect(consoleSpy).toHaveBeenCalledWith('404');
  });

  it('shows toast when globalShowToast is set', () => {
    const mockToast = jest.fn();
    setGlobalToast(mockToast);
    handleError(new Error('boom'), 'Sync');
    expect(mockToast).toHaveBeenCalledWith('Sync: boom', 'error');
  });

  it('shows toast without context when none provided', () => {
    const mockToast = jest.fn();
    setGlobalToast(mockToast);
    handleError(new Error('boom'));
    expect(mockToast).toHaveBeenCalledWith('boom', 'error');
  });

  it('does not throw when globalShowToast is null', () => {
    expect(() => handleError(new Error('safe'))).not.toThrow();
  });

  it('handles null error value', () => {
    handleError(null);
    expect(consoleSpy).toHaveBeenCalledWith('null');
  });

  it('handles undefined error value', () => {
    handleError(undefined);
    expect(consoleSpy).toHaveBeenCalledWith('undefined');
  });
});
