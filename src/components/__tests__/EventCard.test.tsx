import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import EventCard from '../EventCard';

jest.mock('../../services/calendar', () => ({
  getEventTypeColor: jest.fn(() => '#FFD700'),
  getEventTypeLabel: jest.fn((type: string) => {
    const labels: Record<string, string> = {
      practice: 'Practice',
      meet: 'Meet',
      team_event: 'Team Event',
      fundraiser: 'Fundraiser',
      social: 'Social',
    };
    return labels[type] || type;
  }),
}));

describe('EventCard', () => {
  const mockOnPress = jest.fn();

  const baseEvent = {
    id: 'evt-1',
    title: 'Morning Practice',
    type: 'practice' as const,
    startDate: '2025-06-01',
    groups: [] as string[],
    createdAt: { seconds: 0, nanoseconds: 0 },
    updatedAt: { seconds: 0, nanoseconds: 0 },
    coachId: 'coach-1',
    coachName: 'Coach K',
  } as any;

  beforeEach(() => {
    mockOnPress.mockClear();
  });

  it('renders event title', () => {
    const { getByText } = render(<EventCard event={baseEvent} onPress={mockOnPress} />);
    expect(getByText('Morning Practice')).toBeTruthy();
  });

  it('renders event type badge', () => {
    const { getByText } = render(<EventCard event={baseEvent} onPress={mockOnPress} />);
    expect(getByText('PRACTICE')).toBeTruthy();
  });

  it('renders start and end time when provided', () => {
    const event = { ...baseEvent, startTime: '6:00 AM', endTime: '7:30 AM' };
    const { getByText } = render(<EventCard event={event} onPress={mockOnPress} />);
    expect(getByText(/6:00 AM/)).toBeTruthy();
    expect(getByText(/7:30 AM/)).toBeTruthy();
  });

  it('renders location when provided', () => {
    const event = { ...baseEvent, location: 'Natatorium' };
    const { getByText } = render(<EventCard event={event} onPress={mockOnPress} />);
    expect(getByText('Natatorium')).toBeTruthy();
  });

  it('renders description when provided', () => {
    const event = { ...baseEvent, description: 'Sprint focus day' };
    const { getByText } = render(<EventCard event={event} onPress={mockOnPress} />);
    expect(getByText('Sprint focus day')).toBeTruthy();
  });

  it('renders group badges when groups are present', () => {
    const event = { ...baseEvent, groups: ['Varsity', 'JV'] };
    const { getByText } = render(<EventCard event={event} onPress={mockOnPress} />);
    expect(getByText('Varsity')).toBeTruthy();
    expect(getByText('JV')).toBeTruthy();
  });

  it('fires onPress when card is pressed', () => {
    const { getByText } = render(<EventCard event={baseEvent} onPress={mockOnPress} />);
    fireEvent.press(getByText('Morning Practice'));
    expect(mockOnPress).toHaveBeenCalledTimes(1);
  });

  it('does not render time when not provided', () => {
    const { queryByText } = render(<EventCard event={baseEvent} onPress={mockOnPress} />);
    // No time text should be present since startTime is undefined
    expect(queryByText(/AM|PM/)).toBeNull();
  });
});
