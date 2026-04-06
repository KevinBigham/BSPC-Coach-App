import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SetItemRow from '../SetItemRow';

describe('SetItemRow', () => {
  const mockOnUpdate = jest.fn();
  const mockOnDelete = jest.fn();

  const baseItem = {
    order: 0,
    reps: 4,
    distance: 100,
    stroke: 'Freestyle',
    interval: '1:30',
    description: '',
    focusPoints: [],
  };

  beforeEach(() => {
    mockOnUpdate.mockClear();
    mockOnDelete.mockClear();
  });

  it('renders set summary with reps, distance, and stroke', () => {
    const { getByText } = render(
      <SetItemRow item={baseItem} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    expect(getByText(/4×100 Freestyle/)).toBeTruthy();
  });

  it('renders interval when provided', () => {
    const { getByText } = render(
      <SetItemRow item={baseItem} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    expect(getByText(/@ 1:30/)).toBeTruthy();
  });

  it('renders yardage (reps * distance)', () => {
    const { getByText } = render(
      <SetItemRow item={baseItem} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    expect(getByText('400')).toBeTruthy();
  });

  it('renders 1-based index', () => {
    const { getByText } = render(
      <SetItemRow item={baseItem} index={2} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    expect(getByText('3')).toBeTruthy();
  });

  it('does not show reps prefix when reps is 1', () => {
    const singleRepItem = { ...baseItem, reps: 1 };
    const { getByText } = render(
      <SetItemRow item={singleRepItem} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    // Should show "100 Freestyle" without "1x" prefix
    expect(getByText(/^100 Freestyle/)).toBeTruthy();
  });

  it('renders description when provided', () => {
    const itemWithDesc = { ...baseItem, description: 'Build by 25' };
    const { getByText } = render(
      <SetItemRow item={itemWithDesc} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    expect(getByText('Build by 25')).toBeTruthy();
  });

  it('fires onDelete on long press', () => {
    const { getByText } = render(
      <SetItemRow item={baseItem} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    fireEvent(getByText(/4×100 Freestyle/), 'longPress');
    expect(mockOnDelete).toHaveBeenCalledTimes(1);
  });

  it('renders without interval when not provided', () => {
    const noIntervalItem = { ...baseItem, interval: undefined };
    const { getByText, queryByText } = render(
      <SetItemRow
        item={noIntervalItem}
        index={0}
        onUpdate={mockOnUpdate}
        onDelete={mockOnDelete}
      />,
    );
    expect(getByText(/4×100 Freestyle/)).toBeTruthy();
    expect(queryByText(/@/)).toBeNull();
  });

  it('renders without crashing for various distances', () => {
    const item200 = { ...baseItem, distance: 200 };
    const { getByText } = render(
      <SetItemRow item={item200} index={0} onUpdate={mockOnUpdate} onDelete={mockOnDelete} />,
    );
    expect(getByText('800')).toBeTruthy(); // 4 * 200
  });
});
