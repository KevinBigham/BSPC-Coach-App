import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import IntervalPicker from '../IntervalPicker';

describe('IntervalPicker', () => {
  const mockOnChange = jest.fn();

  beforeEach(() => {
    mockOnChange.mockClear();
  });

  it('renders the text input with current value', () => {
    const { getByDisplayValue } = render(<IntervalPicker value="1:00" onChange={mockOnChange} />);
    expect(getByDisplayValue('1:00')).toBeTruthy();
  });

  it('renders preset interval options', () => {
    const { getByText } = render(<IntervalPicker value="" onChange={mockOnChange} />);
    expect(getByText('0:30')).toBeTruthy();
    expect(getByText('1:00')).toBeTruthy();
    expect(getByText('1:30')).toBeTruthy();
    expect(getByText('2:00')).toBeTruthy();
  });

  it('fires onChange when a preset is pressed', () => {
    const { getByText } = render(<IntervalPicker value="" onChange={mockOnChange} />);
    fireEvent.press(getByText('1:30'));
    expect(mockOnChange).toHaveBeenCalledWith('1:30');
  });

  it('fires onChange when text input changes', () => {
    const { getByDisplayValue } = render(<IntervalPicker value="1:00" onChange={mockOnChange} />);
    fireEvent.changeText(getByDisplayValue('1:00'), '1:15');
    expect(mockOnChange).toHaveBeenCalledWith('1:15');
  });

  it('renders with empty value', () => {
    const { toJSON } = render(<IntervalPicker value="" onChange={mockOnChange} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows placeholder text when value is empty', () => {
    const { getByPlaceholderText } = render(<IntervalPicker value="" onChange={mockOnChange} />);
    expect(getByPlaceholderText('M:SS')).toBeTruthy();
  });
});
