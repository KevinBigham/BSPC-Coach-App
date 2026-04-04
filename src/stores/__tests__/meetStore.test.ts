jest.mock('../../config/firebase', () => require('../../__mocks__/firebase'));

import { useMeetStore } from '../meetStore';
import type { Meet, MeetEntry, Relay } from '../../types/meet.types';

type MeetWithId = Meet & { id: string };
type EntryWithId = MeetEntry & { id: string };
type RelayWithId = Relay & { id: string };

function makeMeet(overrides: Partial<MeetWithId> = {}): MeetWithId {
  return {
    id: 'meet1',
    name: 'Dual Meet vs Rival',
    location: 'Home Pool',
    course: 'SCY',
    startDate: '2026-04-10',
    status: 'upcoming',
    events: [],
    groups: [],
    coachId: 'c1',
    coachName: 'Coach K',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeEntry(overrides: Partial<EntryWithId> = {}): EntryWithId {
  return {
    id: 'e1',
    meetId: 'meet1',
    swimmerId: 'sw1',
    swimmerName: 'Test Swimmer',
    group: 'Gold',
    gender: 'M',
    age: 16,
    eventName: '100 Free',
    eventNumber: 3,
    createdAt: new Date(),
    ...overrides,
  };
}

function makeRelay(overrides: Partial<RelayWithId> = {}): RelayWithId {
  return {
    id: 'r1',
    meetId: 'meet1',
    eventName: '200 Medley Relay',
    gender: 'M',
    teamName: 'BSPC A',
    legs: [],
    createdAt: new Date(),
    ...overrides,
  };
}

describe('meetStore', () => {
  beforeEach(() => {
    useMeetStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useMeetStore.getState();
    expect(state.currentMeet).toBeNull();
    expect(state.entries).toEqual([]);
    expect(state.relays).toEqual([]);
    expect(state.activeTab).toBe('overview');
    expect(state.selectedSwimmerIds.size).toBe(0);
    expect(state.selectedEvents.size).toBe(0);
    expect(state.filterGroup).toBe('All');
  });

  it('setCurrentMeet sets the meet', () => {
    const meet = makeMeet();
    useMeetStore.getState().setCurrentMeet(meet);
    expect(useMeetStore.getState().currentMeet).toEqual(meet);
  });

  it('setEntries and setRelays populate data', () => {
    const entries = [makeEntry({ id: 'e1' }), makeEntry({ id: 'e2', eventName: '200 IM' })];
    const relays = [makeRelay()];

    useMeetStore.getState().setEntries(entries);
    useMeetStore.getState().setRelays(relays);

    expect(useMeetStore.getState().entries).toHaveLength(2);
    expect(useMeetStore.getState().relays).toHaveLength(1);
  });

  it('setActiveTab changes the tab', () => {
    useMeetStore.getState().setActiveTab('entries');
    expect(useMeetStore.getState().activeTab).toBe('entries');
  });

  it('toggleSwimmer adds and removes swimmer IDs', () => {
    useMeetStore.getState().toggleSwimmer('sw1');
    expect(useMeetStore.getState().selectedSwimmerIds.has('sw1')).toBe(true);

    useMeetStore.getState().toggleSwimmer('sw1');
    expect(useMeetStore.getState().selectedSwimmerIds.has('sw1')).toBe(false);
  });

  it('toggleEvent adds and removes event names', () => {
    useMeetStore.getState().toggleEvent('100 Free');
    expect(useMeetStore.getState().selectedEvents.has('100 Free')).toBe(true);

    useMeetStore.getState().toggleEvent('100 Free');
    expect(useMeetStore.getState().selectedEvents.has('100 Free')).toBe(false);
  });

  it('selectAllSwimmers replaces selected set', () => {
    useMeetStore.getState().toggleSwimmer('old');
    useMeetStore.getState().selectAllSwimmers(['sw1', 'sw2', 'sw3']);

    const ids = useMeetStore.getState().selectedSwimmerIds;
    expect(ids.size).toBe(3);
    expect(ids.has('old')).toBe(false);
    expect(ids.has('sw2')).toBe(true);
  });

  it('clearSelection clears both swimmers and events', () => {
    useMeetStore.getState().toggleSwimmer('sw1');
    useMeetStore.getState().toggleEvent('100 Free');
    useMeetStore.getState().clearSelection();

    expect(useMeetStore.getState().selectedSwimmerIds.size).toBe(0);
    expect(useMeetStore.getState().selectedEvents.size).toBe(0);
  });

  it('setFilterGroup changes the filter', () => {
    useMeetStore.getState().setFilterGroup('Gold');
    expect(useMeetStore.getState().filterGroup).toBe('Gold');
  });

  it('entryCount returns number of entries', () => {
    useMeetStore.getState().setEntries([makeEntry({ id: 'e1' }), makeEntry({ id: 'e2' })]);
    expect(useMeetStore.getState().entryCount()).toBe(2);
  });

  it('entriesByEvent groups entries by eventName', () => {
    useMeetStore
      .getState()
      .setEntries([
        makeEntry({ id: 'e1', eventName: '100 Free' }),
        makeEntry({ id: 'e2', eventName: '200 IM' }),
        makeEntry({ id: 'e3', eventName: '100 Free' }),
      ]);

    const byEvent = useMeetStore.getState().entriesByEvent();
    expect(byEvent['100 Free']).toHaveLength(2);
    expect(byEvent['200 IM']).toHaveLength(1);
  });

  it('entriesBySwimmer groups entries by swimmerId', () => {
    useMeetStore
      .getState()
      .setEntries([
        makeEntry({ id: 'e1', swimmerId: 'sw1' }),
        makeEntry({ id: 'e2', swimmerId: 'sw2' }),
        makeEntry({ id: 'e3', swimmerId: 'sw1' }),
      ]);

    const bySwimmer = useMeetStore.getState().entriesBySwimmer();
    expect(bySwimmer['sw1']).toHaveLength(2);
    expect(bySwimmer['sw2']).toHaveLength(1);
  });

  it('reset clears all state', () => {
    useMeetStore.getState().setCurrentMeet(makeMeet());
    useMeetStore.getState().setEntries([makeEntry()]);
    useMeetStore.getState().toggleSwimmer('sw1');
    useMeetStore.getState().setActiveTab('relays');

    useMeetStore.getState().reset();

    const state = useMeetStore.getState();
    expect(state.currentMeet).toBeNull();
    expect(state.entries).toEqual([]);
    expect(state.activeTab).toBe('overview');
    expect(state.selectedSwimmerIds.size).toBe(0);
  });
});
