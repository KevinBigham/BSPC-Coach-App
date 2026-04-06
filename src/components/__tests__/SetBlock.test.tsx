jest.mock('../SetItemRow', () => {
  const React = require('react');
  const { View, Text } = require('react-native');
  return {
    __esModule: true,
    default: ({
      item,
      index,
    }: {
      item: { stroke: string; reps: number; distance: number };
      index: number;
    }) =>
      React.createElement(
        View,
        { testID: `set-item-row-${index}` },
        React.createElement(Text, null, `${item.reps}x${item.distance} ${item.stroke}`),
      ),
  };
});

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import SetBlock from '../SetBlock';
import type { PracticePlanSet } from '../../types/firestore.types';

const makeSet = (overrides?: Partial<PracticePlanSet>): PracticePlanSet => ({
  order: 0,
  name: 'Warm Up',
  category: 'Warmup',
  items: [
    { order: 0, reps: 4, distance: 100, stroke: 'Freestyle', focusPoints: [] },
    { order: 1, reps: 2, distance: 50, stroke: 'Backstroke', focusPoints: [] },
  ],
  ...overrides,
});

const defaultProps = () => ({
  set: makeSet(),
  setIndex: 0,
  onUpdateName: jest.fn(),
  onUpdateDescription: jest.fn(),
  onAddItem: jest.fn(),
  onRemoveItem: jest.fn(),
  onUpdateItem: jest.fn(),
  onMoveUp: jest.fn(),
  onMoveDown: jest.fn(),
  onDelete: jest.fn(),
  isFirst: false,
  isLast: false,
});

describe('SetBlock', () => {
  it('renders category label', () => {
    const { getByText } = render(<SetBlock {...defaultProps()} />);
    expect(getByText('Warmup')).toBeTruthy();
  });

  it('renders yardage total', () => {
    // 4*100 + 2*50 = 500
    const { getByText } = render(<SetBlock {...defaultProps()} />);
    expect(getByText('500')).toBeTruthy();
  });

  it('renders set items', () => {
    const { getByText } = render(<SetBlock {...defaultProps()} />);
    expect(getByText('4x100 Freestyle')).toBeTruthy();
    expect(getByText('2x50 Backstroke')).toBeTruthy();
  });

  it('renders + ADD ITEM button', () => {
    const { getByText } = render(<SetBlock {...defaultProps()} />);
    expect(getByText('+ ADD ITEM')).toBeTruthy();
  });

  it('calls onAddItem when add button pressed', () => {
    const props = defaultProps();
    const { getByText } = render(<SetBlock {...props} />);
    fireEvent.press(getByText('+ ADD ITEM'));
    expect(props.onAddItem).toHaveBeenCalled();
  });

  it('calls onMoveUp when up arrow pressed', () => {
    const props = defaultProps();
    const { getByText } = render(<SetBlock {...props} />);
    fireEvent.press(getByText('\u25B2'));
    expect(props.onMoveUp).toHaveBeenCalled();
  });

  it('calls onMoveDown when down arrow pressed', () => {
    const props = defaultProps();
    const { getByText } = render(<SetBlock {...props} />);
    fireEvent.press(getByText('\u25BC'));
    expect(props.onMoveDown).toHaveBeenCalled();
  });

  it('hides move-up arrow when isFirst', () => {
    const props = { ...defaultProps(), isFirst: true };
    const { queryByText } = render(<SetBlock {...props} />);
    expect(queryByText('\u25B2')).toBeNull();
  });

  it('hides move-down arrow when isLast', () => {
    const props = { ...defaultProps(), isLast: true };
    const { queryByText } = render(<SetBlock {...props} />);
    expect(queryByText('\u25BC')).toBeNull();
  });

  it('collapses items on header press', () => {
    const { getByText, queryByText } = render(<SetBlock {...defaultProps()} />);
    // Items visible initially
    expect(queryByText('+ ADD ITEM')).toBeTruthy();
    // Press header to collapse — press the chevron area via the category label's parent
    fireEvent.press(getByText('\u25BE'));
    // After collapse, items should be hidden
    expect(queryByText('+ ADD ITEM')).toBeNull();
  });

  it('expands items after collapsing', () => {
    const { getByText, queryByText } = render(<SetBlock {...defaultProps()} />);
    // Collapse
    fireEvent.press(getByText('\u25BE'));
    expect(queryByText('+ ADD ITEM')).toBeNull();
    // Expand
    fireEvent.press(getByText('\u25B8'));
    expect(queryByText('+ ADD ITEM')).toBeTruthy();
  });
});
