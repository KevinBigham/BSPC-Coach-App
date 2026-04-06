import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import CalendarMonth from '../CalendarMonth';

jest.mock('../../services/calendar', () => ({
  getEventTypeColor: jest.fn(() => '#FFD700'),
}));

describe('CalendarMonth', () => {
  const mockOnSelectDate = jest.fn();

  beforeEach(() => {
    mockOnSelectDate.mockClear();
  });

  it('renders day-of-week headers', () => {
    const { getByText } = render(
      <CalendarMonth
        year={2025}
        month={5}
        events={[]}
        selectedDate={null}
        onSelectDate={mockOnSelectDate}
      />,
    );
    expect(getByText('Sun')).toBeTruthy();
    expect(getByText('Mon')).toBeTruthy();
    expect(getByText('Tue')).toBeTruthy();
    expect(getByText('Wed')).toBeTruthy();
    expect(getByText('Thu')).toBeTruthy();
    expect(getByText('Fri')).toBeTruthy();
    expect(getByText('Sat')).toBeTruthy();
  });

  it('renders days of the month', () => {
    const { getByText } = render(
      <CalendarMonth
        year={2025}
        month={0}
        events={[]}
        selectedDate={null}
        onSelectDate={mockOnSelectDate}
      />,
    );
    // January 2025 has 31 days
    expect(getByText('1')).toBeTruthy();
    expect(getByText('15')).toBeTruthy();
    expect(getByText('31')).toBeTruthy();
  });

  it('fires onSelectDate with correct date string when a day is pressed', () => {
    const { getByText } = render(
      <CalendarMonth
        year={2025}
        month={5}
        events={[]}
        selectedDate={null}
        onSelectDate={mockOnSelectDate}
      />,
    );
    fireEvent.press(getByText('10'));
    expect(mockOnSelectDate).toHaveBeenCalledWith('2025-06-10');
  });

  it('fires onSelectDate with zero-padded month and day', () => {
    const { getByText } = render(
      <CalendarMonth
        year={2025}
        month={0}
        events={[]}
        selectedDate={null}
        onSelectDate={mockOnSelectDate}
      />,
    );
    fireEvent.press(getByText('5'));
    expect(mockOnSelectDate).toHaveBeenCalledWith('2025-01-05');
  });

  it('renders event dots for dates with events', () => {
    const events: any[] = [
      {
        id: 'e1',
        title: 'Practice',
        type: 'practice' as const,
        startDate: '2025-06-15',
        groups: [],
        coachId: 'c1',
        coachName: 'Coach K',
        createdAt: { seconds: 0, nanoseconds: 0 },
        updatedAt: { seconds: 0, nanoseconds: 0 },
      },
    ];
    const { toJSON } = render(
      <CalendarMonth
        year={2025}
        month={5}
        events={events}
        selectedDate={null}
        onSelectDate={mockOnSelectDate}
      />,
    );
    // Dots are rendered for events - just verify component doesn't crash
    expect(toJSON()).toBeTruthy();
  });

  it('renders correctly with a selected date', () => {
    const { toJSON } = render(
      <CalendarMonth
        year={2025}
        month={5}
        events={[]}
        selectedDate="2025-06-15"
        onSelectDate={mockOnSelectDate}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles February correctly', () => {
    const { getByText, queryByText } = render(
      <CalendarMonth
        year={2025}
        month={1}
        events={[]}
        selectedDate={null}
        onSelectDate={mockOnSelectDate}
      />,
    );
    expect(getByText('28')).toBeTruthy();
    // 2025 is not a leap year, so no day 29
    expect(queryByText('29')).toBeNull();
  });
});
