import type { FirebaseTimestamp } from './firestore.types';

export type PracticePlanDocumentType = 'dashboard_pdf';

export interface DashboardPracticePlanPdf {
  id?: string;
  documentType: PracticePlanDocumentType;
  coachId: string;
  date: string;
  storagePath: string;
  filename: string;
  uploadedAt: FirebaseTimestamp;
  sizeBytes: number;
  pageCount?: number;
}
