jest.mock('../../utils/meetTiming', () => ({
  formatSplitDisplay: (hundredths: number) => {
    const mins = Math.floor(hundredths / 6000);
    const secs = Math.floor((hundredths % 6000) / 100);
    const hs = hundredths % 100;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
    }
    return `${secs}.${hs.toString().padStart(2, '0')}`;
  },
}));

jest.mock('../../utils/haptics', () => ({
  notifyHeavy: jest.fn(),
}));

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import PRCelebration from '../PRCelebration';
import { notifyHeavy } from '../../utils/haptics';

const defaultProps = () => ({
  swimmerName: 'Jane Doe',
  eventName: '100 Free',
  newTime: 6523,
  onDismiss: jest.fn(),
});

describe('PRCelebration', () => {
  it('renders PERSONAL RECORD label', () => {
    const { getByText } = render(<PRCelebration {...defaultProps()} />);
    expect(getByText('PERSONAL RECORD')).toBeTruthy();
  });

  it('fires heavy haptics when mounted', () => {
    render(<PRCelebration {...defaultProps()} />);
    expect(notifyHeavy).toHaveBeenCalled();
  });

  it('renders swimmer name uppercased', () => {
    const { getByText } = render(<PRCelebration {...defaultProps()} />);
    expect(getByText('JANE DOE')).toBeTruthy();
  });

  it('renders event name', () => {
    const { getByText } = render(<PRCelebration {...defaultProps()} />);
    expect(getByText('100 Free')).toBeTruthy();
  });

  it('renders new time formatted', () => {
    const { getByText } = render(<PRCelebration {...defaultProps()} />);
    // 6523 hundredths = 1:05.23
    expect(getByText('1:05.23')).toBeTruthy();
  });

  it('renders TAP TO DISMISS hint', () => {
    const { getByText } = render(<PRCelebration {...defaultProps()} />);
    expect(getByText('TAP TO DISMISS')).toBeTruthy();
  });

  it('calls onDismiss when pressed', () => {
    const props = defaultProps();
    const { getByText } = render(<PRCelebration {...props} />);
    fireEvent.press(getByText('TAP TO DISMISS'));
    expect(props.onDismiss).toHaveBeenCalled();
  });

  it('renders time drop when oldTime provided', () => {
    const props = { ...defaultProps(), oldTime: 7000 };
    const { getByText } = render(<PRCelebration {...props} />);
    // oldTime - newTime = 7000 - 6523 = 477 hundredths = 4.77
    expect(getByText(/4\.77/)).toBeTruthy();
  });

  it('does not render drop row when no oldTime', () => {
    const { queryByText } = render(<PRCelebration {...defaultProps()} />);
    // The drop amount prefix is "-" so look for that pattern
    expect(queryByText(/^-/)).toBeNull();
  });
});
