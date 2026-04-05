jest.mock('../../config/firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  storage: {},
  functions: {},
}));

jest.mock('docx', () => ({
  Document: jest.fn().mockImplementation(() => ({})),
  Packer: {
    toBlob: jest.fn().mockResolvedValue(new Blob(['mock docx content'])),
  },
  Paragraph: jest.fn().mockImplementation(() => ({})),
  TextRun: jest.fn().mockImplementation(() => ({})),
  HeadingLevel: { HEADING_1: 'HEADING_1', HEADING_2: 'HEADING_2' },
  AlignmentType: { CENTER: 'CENTER' },
  BorderStyle: { SINGLE: 'SINGLE' },
  TableRow: jest.fn(),
  TableCell: jest.fn(),
  Table: jest.fn(),
  WidthType: { AUTO: 'AUTO' },
}));

jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: '/mock/cache/',
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  EncodingType: { Base64: 'base64' },
}));

jest.mock('expo-sharing', () => ({
  shareAsync: jest.fn().mockResolvedValue(undefined),
}));

import {
  exportPracticePlanDocx,
  exportSwimmerReportDocx,
  exportGroupReportDocx,
} from '../docxExport';
import { Document, Packer } from 'docx';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
const mockPlan = {
  title: 'Test Practice',
  coachId: 'c1',
  coachName: 'Coach Kevin',
  group: 'Gold',
  date: '2026-04-04',
  description: 'A test practice plan',
  totalDuration: 90,
  isTemplate: false,
  sets: [
    {
      name: 'Warm Up',
      category: 'Warmup',
      description: 'Easy swimming',
      order: 0,
      items: [
        {
          stroke: 'Free',
          distance: 200,
          reps: 1,
          interval: '4:00',
          description: 'Easy free',
          focusPoints: ['Catch'],
          order: 0,
        },
      ],
    },
  ],
  createdAt: new Date(),
  updatedAt: new Date(),
} as any;

const mockSwimmer = {
  firstName: 'Alice',
  lastName: 'Smith',
  displayName: 'Alice Smith',
  group: 'Gold',
  gender: 'F',
  active: true,
  usaSwimmingId: '12345',
  goals: ['Drop 50 Free time'],
  strengths: ['Sprint Free'],
  weaknesses: [],
  techniqueFocusAreas: ['Turns'],
  parentContacts: [],
} as any;

const mockTimes = [
  {
    event: '50 Free',
    time: 2850,
    timeDisplay: '28.50',
    course: 'SCY',
    isPR: true,
    meetName: 'Spring Meet',
    createdAt: new Date(),
  },
] as any[];

const mockAttendance = [
  {
    swimmerId: 'sw1',
    swimmerName: 'Alice Smith',
    practiceDate: '2026-04-01',
    status: 'normal',
    createdAt: new Date(),
  },
] as any[];

describe('docxExport', () => {
  beforeEach(() => jest.clearAllMocks());

  it('exportPracticePlanDocx creates doc and shares', async () => {
    await exportPracticePlanDocx(mockPlan);
    expect(Document).toHaveBeenCalled();
    expect(Packer.toBlob).toHaveBeenCalled();
    expect(FileSystem.writeAsStringAsync).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      expect.stringContaining('.docx'),
      expect.any(Object),
    );
  });

  it('exportSwimmerReportDocx creates doc and shares', async () => {
    await exportSwimmerReportDocx(mockSwimmer, mockTimes, mockAttendance);
    expect(Document).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });

  it('exportGroupReportDocx creates doc and shares', async () => {
    await exportGroupReportDocx('Gold', [mockSwimmer], {
      totalPractices: 20,
      averageAttendance: 15,
      attendancePercent: 75,
    });
    expect(Document).toHaveBeenCalled();
    expect(Sharing.shareAsync).toHaveBeenCalled();
  });
});
