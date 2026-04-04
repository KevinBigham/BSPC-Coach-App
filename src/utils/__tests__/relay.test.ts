import {
  estimateSplit,
  optimizeFreeRelayOrder,
  optimizeMedleyRelayOrder,
  estimateRelayTime,
  calculatePlacement,
  formatRelayLeg,
} from '../relay';
import { buildSwimTime } from '../../__tests__/factories/swimmerFactory';

// Mock the formatTime dependency
jest.mock('../../data/timeStandards', () => ({
  formatTime: (hundredths: number) => {
    const mins = Math.floor(hundredths / 6000);
    const secs = Math.floor((hundredths % 6000) / 100);
    const hs = hundredths % 100;
    if (mins > 0) {
      return `${mins}:${secs.toString().padStart(2, '0')}.${hs.toString().padStart(2, '0')}`;
    }
    return `${secs}.${hs.toString().padStart(2, '0')}`;
  },
}));

describe('estimateSplit', () => {
  it('returns the best time for a matching event', () => {
    const times = [
      buildSwimTime({ id: '1', event: '50 Free', time: 2500 }),
      buildSwimTime({ id: '2', event: '50 Free', time: 2400 }),
    ];
    expect(estimateSplit(times, 'Freestyle', 50)).toBe(2400);
  });

  it('returns null when no matching event exists', () => {
    const times = [buildSwimTime({ id: '1', event: '100 Back', time: 6000 })];
    expect(estimateSplit(times, 'Freestyle', 50)).toBeNull();
  });

  it('returns null for empty times array', () => {
    expect(estimateSplit([], 'Freestyle', 50)).toBeNull();
  });

  it('maps Freestyle stroke to Free event name', () => {
    const times = [buildSwimTime({ id: '1', event: '100 Free', time: 5500 })];
    expect(estimateSplit(times, 'Freestyle', 100)).toBe(5500);
  });

  it('uses stroke name directly for non-Freestyle strokes', () => {
    const times = [buildSwimTime({ id: '1', event: '100 Backstroke', time: 6200 })];
    expect(estimateSplit(times, 'Backstroke', 100)).toBe(6200);
  });
});

describe('optimizeFreeRelayOrder', () => {
  const swimmers = [
    { swimmerId: 'a', swimmerName: 'Alice', time: 2500 },
    { swimmerId: 'b', swimmerName: 'Bob', time: 2300 },
    { swimmerId: 'c', swimmerName: 'Carol', time: 2700 },
    { swimmerId: 'd', swimmerName: 'Dave', time: 2400 },
  ];

  it('orders: 2nd fastest leads, slowest 2nd, 3rd fastest 3rd, fastest anchors', () => {
    // Sorted by time: Bob(2300), Dave(2400), Alice(2500), Carol(2700)
    // Expected order: Dave(2nd), Carol(slowest), Alice(3rd), Bob(fastest)
    const result = optimizeFreeRelayOrder(swimmers);
    expect(result[0].swimmerName).toBe('Dave');
    expect(result[1].swimmerName).toBe('Carol');
    expect(result[2].swimmerName).toBe('Alice');
    expect(result[3].swimmerName).toBe('Bob');
  });

  it('returns original array if not exactly 4 swimmers', () => {
    const three = swimmers.slice(0, 3);
    expect(optimizeFreeRelayOrder(three)).toEqual(three);
  });

  it('returns original array for empty input', () => {
    expect(optimizeFreeRelayOrder([])).toEqual([]);
  });

  it('does not mutate the original array', () => {
    const original = [...swimmers];
    optimizeFreeRelayOrder(swimmers);
    expect(swimmers).toEqual(original);
  });
});

describe('optimizeMedleyRelayOrder', () => {
  it('assigns swimmers greedily to each stroke', () => {
    const swimmerTimes = {
      a: { swimmerId: 'a', swimmerName: 'Alice', times: { Backstroke: 3000, Breaststroke: 3500 } },
      b: { swimmerId: 'b', swimmerName: 'Bob', times: { Backstroke: 3200, Breaststroke: 3100 } },
      c: { swimmerId: 'c', swimmerName: 'Carol', times: { Butterfly: 2800, Freestyle: 2500 } },
      d: { swimmerId: 'd', swimmerName: 'Dave', times: { Butterfly: 3000, Freestyle: 2600 } },
    };

    const result = optimizeMedleyRelayOrder(swimmerTimes);
    expect(result).toHaveLength(4);
    expect(result[0].stroke).toBe('Backstroke');
    expect(result[0].swimmerName).toBe('Alice');
    expect(result[1].stroke).toBe('Breaststroke');
    expect(result[1].swimmerName).toBe('Bob');
    expect(result[2].stroke).toBe('Butterfly');
    expect(result[2].swimmerName).toBe('Carol');
    expect(result[3].stroke).toBe('Freestyle');
    expect(result[3].swimmerName).toBe('Dave');
  });

  it('returns empty array when no swimmers provided', () => {
    expect(optimizeMedleyRelayOrder({})).toEqual([]);
  });

  it('assigns correct order numbers starting at 1', () => {
    const swimmerTimes = {
      a: { swimmerId: 'a', swimmerName: 'A', times: { Backstroke: 3000 } },
      b: { swimmerId: 'b', swimmerName: 'B', times: { Breaststroke: 3100 } },
      c: { swimmerId: 'c', swimmerName: 'C', times: { Butterfly: 2800 } },
      d: { swimmerId: 'd', swimmerName: 'D', times: { Freestyle: 2500 } },
    };

    const result = optimizeMedleyRelayOrder(swimmerTimes);
    expect(result.map((l) => l.order)).toEqual([1, 2, 3, 4]);
  });

  it('includes splitTimeDisplay when time exists', () => {
    const swimmerTimes = {
      a: { swimmerId: 'a', swimmerName: 'A', times: { Backstroke: 6523 } },
    };
    const result = optimizeMedleyRelayOrder(swimmerTimes);
    expect(result[0].splitTimeDisplay).toBe('1:05.23');
  });
});

describe('estimateRelayTime', () => {
  it('sums all split times', () => {
    const legs = [
      { order: 1, swimmerId: 'a', swimmerName: 'A', stroke: 'Back', splitTime: 3000 },
      { order: 2, swimmerId: 'b', swimmerName: 'B', stroke: 'Breast', splitTime: 3200 },
      { order: 3, swimmerId: 'c', swimmerName: 'C', stroke: 'Fly', splitTime: 2800 },
      { order: 4, swimmerId: 'd', swimmerName: 'D', stroke: 'Free', splitTime: 2500 },
    ];
    expect(estimateRelayTime(legs)).toBe(11500);
  });

  it('returns 0 for empty legs array', () => {
    expect(estimateRelayTime([])).toBe(0);
  });

  it('treats undefined splitTime as 0', () => {
    const legs = [
      { order: 1, swimmerId: 'a', swimmerName: 'A', stroke: 'Back', splitTime: 3000 },
      { order: 2, swimmerId: 'b', swimmerName: 'B', stroke: 'Breast' },
    ];
    expect(estimateRelayTime(legs)).toBe(3000);
  });
});

describe('calculatePlacement', () => {
  it('assigns places based on time', () => {
    const times = [
      { teamName: 'Team C', time: 15000 },
      { teamName: 'Team A', time: 11000 },
      { teamName: 'Team B', time: 13000 },
    ];
    const result = calculatePlacement(times);
    expect(result[0]).toEqual({ teamName: 'Team A', time: 11000, place: 1 });
    expect(result[1]).toEqual({ teamName: 'Team B', time: 13000, place: 2 });
    expect(result[2]).toEqual({ teamName: 'Team C', time: 15000, place: 3 });
  });

  it('returns empty array for empty input', () => {
    expect(calculatePlacement([])).toEqual([]);
  });

  it('handles single team', () => {
    const result = calculatePlacement([{ teamName: 'Solo', time: 10000 }]);
    expect(result).toEqual([{ teamName: 'Solo', time: 10000, place: 1 }]);
  });
});

describe('formatRelayLeg', () => {
  it('formats a leg with splitTimeDisplay', () => {
    const leg = {
      order: 1,
      swimmerId: 'a',
      swimmerName: 'Alice',
      stroke: 'Backstroke',
      splitTime: 3000,
      splitTimeDisplay: '30.00',
    };
    expect(formatRelayLeg(leg)).toBe('1. Alice — Backstroke (30.00)');
  });

  it('formats a leg using splitTime when no display string', () => {
    const leg = {
      order: 2,
      swimmerId: 'b',
      swimmerName: 'Bob',
      stroke: 'Breaststroke',
      splitTime: 6523,
    };
    expect(formatRelayLeg(leg)).toBe('2. Bob — Breaststroke (1:05.23)');
  });

  it('shows NT when no time at all', () => {
    const leg = {
      order: 3,
      swimmerId: 'c',
      swimmerName: 'Carol',
      stroke: 'Butterfly',
    };
    expect(formatRelayLeg(leg)).toBe('3. Carol — Butterfly (NT)');
  });
});
