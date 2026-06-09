/**
 * parent-portal getParentProfile — identity resolution via the canonical
 * profiles + guardianships tables (UNIFY/05 Phase A, ratified Option (b)).
 *
 * Lives under test/ (not parent-portal/) because jest.config.js ignores
 * /parent-portal/ test paths; the module under test is plain TS with no
 * Next.js or Firebase imports.
 */
const profilesBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  maybeSingle: jest.fn(),
};

const guardianshipsBuilder = {
  select: jest.fn().mockReturnThis(),
  eq: jest.fn(),
};

const mockFrom = jest.fn((table: string) =>
  table === 'profiles' ? profilesBuilder : guardianshipsBuilder,
);

jest.mock('../parent-portal/src/lib/supabase', () => ({
  // Lazy lookup: jest hoists this factory above the const declarations, so
  // dereferencing mockFrom here at call time (not factory-eval time) is required.
  supabase: { from: (table: string) => mockFrom(table) },
}));

import { getParentProfile } from '../parent-portal/src/lib/profile';

describe('getParentProfile (Supabase identity read)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    profilesBuilder.select.mockReturnThis();
    profilesBuilder.eq.mockReturnThis();
    guardianshipsBuilder.select.mockReturnThis();
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: { id: 'profile-1', email: 'parent@example.com', full_name: 'Pat Parent' },
      error: null,
    });
    guardianshipsBuilder.eq.mockResolvedValue({
      data: [{ swimmer_id: 'swimmer-1' }, { swimmer_id: 'swimmer-2' }],
      error: null,
    });
  });

  it('resolves the caller via profiles.user_id and derives linkedSwimmerIds from guardianships', async () => {
    const result = await getParentProfile('auth-user-1');

    expect(mockFrom).toHaveBeenCalledWith('profiles');
    expect(profilesBuilder.eq).toHaveBeenCalledWith('user_id', 'auth-user-1');
    expect(mockFrom).toHaveBeenCalledWith('guardianships');
    expect(guardianshipsBuilder.eq).toHaveBeenCalledWith('guardian_profile_id', 'profile-1');
    expect(result).toEqual({
      uid: 'auth-user-1',
      email: 'parent@example.com',
      displayName: 'Pat Parent',
      linkedSwimmerIds: ['swimmer-1', 'swimmer-2'],
    });
  });

  it('returns null (and never queries guardianships) when no profiles row matches', async () => {
    profilesBuilder.maybeSingle.mockResolvedValue({ data: null, error: null });

    const result = await getParentProfile('unknown-user');

    expect(result).toBeNull();
    expect(mockFrom).not.toHaveBeenCalledWith('guardianships');
  });

  it('returns empty linkedSwimmerIds when the parent has no guardianships', async () => {
    guardianshipsBuilder.eq.mockResolvedValue({ data: [], error: null });

    const result = await getParentProfile('auth-user-1');

    expect(result?.linkedSwimmerIds).toEqual([]);
  });

  it('throws when the profiles query errors', async () => {
    profilesBuilder.maybeSingle.mockResolvedValue({
      data: null,
      error: new Error('profiles boom'),
    });

    await expect(getParentProfile('auth-user-1')).rejects.toThrow('profiles boom');
  });

  it('throws when the guardianships query errors', async () => {
    guardianshipsBuilder.eq.mockResolvedValue({
      data: null,
      error: new Error('guardianships boom'),
    });

    await expect(getParentProfile('auth-user-1')).rejects.toThrow('guardianships boom');
  });
});
