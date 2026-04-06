import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import StrokeSelector from '../StrokeSelector';

describe('StrokeSelector', () => {
  const mockOnSelect = jest.fn();

  beforeEach(() => {
    mockOnSelect.mockClear();
  });

  it('renders all stroke options', () => {
    const { getByText } = render(<StrokeSelector selected="Freestyle" onSelect={mockOnSelect} />);
    expect(getByText('Freestyle')).toBeTruthy();
    expect(getByText('Backstroke')).toBeTruthy();
    expect(getByText('Breaststroke')).toBeTruthy();
    expect(getByText('Butterfly')).toBeTruthy();
    expect(getByText('IM')).toBeTruthy();
    expect(getByText('Kick')).toBeTruthy();
    expect(getByText('Pull')).toBeTruthy();
    expect(getByText('Drill')).toBeTruthy();
  });

  it('fires onSelect when a stroke is pressed', () => {
    const { getByText } = render(<StrokeSelector selected="Freestyle" onSelect={mockOnSelect} />);
    fireEvent.press(getByText('Backstroke'));
    expect(mockOnSelect).toHaveBeenCalledWith('Backstroke');
  });

  it('fires onSelect with the correct stroke for each option', () => {
    const { getByText } = render(<StrokeSelector selected="" onSelect={mockOnSelect} />);
    fireEvent.press(getByText('Butterfly'));
    expect(mockOnSelect).toHaveBeenCalledWith('Butterfly');
  });

  it('renders without crashing when no stroke is selected', () => {
    const { toJSON } = render(<StrokeSelector selected="" onSelect={mockOnSelect} />);
    expect(toJSON()).toBeTruthy();
  });
});
