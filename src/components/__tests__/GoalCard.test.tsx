import React from 'react';
import { render } from '@testing-library/react-native';
import GoalCard from '../GoalCard';

jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

jest.mock('../../data/timeStandards', () => ({
  formatTime: jest.fn((hundredths: number) => {
    const mins = Math.floor(hundredths / 6000);
    const secs = Math.floor((hundredths % 6000) / 100);
    const hs = hundredths % 100;
    if (mins > 0) return `${mins}:${String(secs).padStart(2, '0')}.${String(hs).padStart(2, '0')}`;
    return `${secs}.${String(hs).padStart(2, '0')}`;
  }),
  getStandard: jest.fn(() => null),
  getAchievedStandard: jest.fn(() => null),
  getTimeToCut: jest.fn(() => null),
}));

describe('GoalCard', () => {
  const baseGoal = {
    id: 'goal-1',
    event: '100 Freestyle',
    course: 'SCY' as const,
    achieved: false,
    currentTime: 6500, // 1:05.00
    targetTime: 6000, // 1:00.00
    notes: '',
    createdAt: { seconds: 0, nanoseconds: 0 },
    updatedAt: { seconds: 0, nanoseconds: 0 },
  } as any;

  it('renders event name', () => {
    const { getByText } = render(<GoalCard goal={baseGoal} gender="M" ageGroup="13-14" />);
    expect(getByText('100 Freestyle')).toBeTruthy();
  });

  it('renders course label', () => {
    const { getByText } = render(<GoalCard goal={baseGoal} gender="M" ageGroup="13-14" />);
    expect(getByText('SCY')).toBeTruthy();
  });

  it('renders CURRENT and TARGET labels', () => {
    const { getByText } = render(<GoalCard goal={baseGoal} gender="M" ageGroup="13-14" />);
    expect(getByText('CURRENT')).toBeTruthy();
    expect(getByText('TARGET')).toBeTruthy();
  });

  it('shows ACHIEVED badge when goal is achieved', () => {
    const achievedGoal = { ...baseGoal, achieved: true };
    const { getByText } = render(<GoalCard goal={achievedGoal} gender="F" ageGroup="15-16" />);
    expect(getByText('ACHIEVED')).toBeTruthy();
  });

  it('does not show ACHIEVED badge when goal is not achieved', () => {
    const { queryByText } = render(<GoalCard goal={baseGoal} gender="M" ageGroup="13-14" />);
    expect(queryByText('ACHIEVED')).toBeNull();
  });

  it('renders formatted current time', () => {
    const { formatTime } = require('../../data/timeStandards');
    render(<GoalCard goal={baseGoal} gender="M" ageGroup="13-14" />);
    expect(formatTime).toHaveBeenCalledWith(6500);
  });

  it('renders dash when no current time', () => {
    const goalNoTime = { ...baseGoal, currentTime: undefined };
    const { getAllByText } = render(<GoalCard goal={goalNoTime} gender="M" ageGroup="13-14" />);
    // Should show dash for current time
    const dashes = getAllByText(/—/);
    expect(dashes.length).toBeGreaterThan(0);
  });

  it('shows target standard label when targetStandard is set', () => {
    const goalWithStandard = { ...baseGoal, targetStandard: 'AA' as const };
    const { getByText } = render(<GoalCard goal={goalWithStandard} gender="M" ageGroup="13-14" />);
    expect(getByText('TARGET (AA)')).toBeTruthy();
  });

  it('renders notes when provided', () => {
    const goalWithNotes = { ...baseGoal, notes: 'Work on turns' };
    const { getByText } = render(<GoalCard goal={goalWithNotes} gender="M" ageGroup="13-14" />);
    expect(getByText('Work on turns')).toBeTruthy();
  });

  it('shows progress text for non-achieved goals with times', () => {
    const { getByText } = render(<GoalCard goal={baseGoal} gender="M" ageGroup="13-14" />);
    expect(getByText(/to cut/)).toBeTruthy();
  });
});
