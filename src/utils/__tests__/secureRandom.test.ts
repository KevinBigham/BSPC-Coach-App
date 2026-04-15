import { secureInviteCode } from '../secureRandom';

describe('secureInviteCode', () => {
  it('generates an invite code with a dash and unambiguous characters', () => {
    const code = secureInviteCode();
    expect(code).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });

  it('does not use Math.random for invite codes', () => {
    const randomSpy = jest.spyOn(Math, 'random').mockImplementation(() => {
      throw new Error('Math.random must not be used for invite codes');
    });

    expect(() => secureInviteCode()).not.toThrow();
    expect(randomSpy).not.toHaveBeenCalled();

    randomSpy.mockRestore();
  });
});
