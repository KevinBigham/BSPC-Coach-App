// 05 §6.2(iii): the forgot-password successor IS the Supabase reset — the
// D-K1 decline ("no Supabase reset mid-migration") expires at the swap.
const mockResetPasswordForEmail = jest.fn();

jest.mock('../../src/config/supabase', () => ({
  supabase: {
    auth: {
      resetPasswordForEmail: (...args: unknown[]) => mockResetPasswordForEmail(...args),
    },
  },
}));

import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ForgotPasswordScreen from '../forgot-password';

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it('sends the reset via supabase.auth.resetPasswordForEmail (trimmed) and shows the sent state', async () => {
    const { getByPlaceholderText, getByText, findByText } = render(<ForgotPasswordScreen />);

    fireEvent.changeText(getByPlaceholderText('coach@bspowercats.com'), '  coach@test.com  ');
    fireEvent.press(getByText('SEND RESET LINK'));

    expect(await findByText('RESET LINK SENT')).toBeTruthy();
    await waitFor(() => {
      expect(mockResetPasswordForEmail).toHaveBeenCalledWith('coach@test.com');
    });
  });
});
