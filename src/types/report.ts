export type ReportStatus =
  | 'pending'
  | 'uploading'
  | 'uploaded'
  | 'failed';

export interface ReportImage {
  id: string;
  reportId: string;
  uri: string;
  size: number;
  mimeType: string;
}

export interface Report {
  id: string;
  description: string;
  status: ReportStatus;
  retryCount: number;
  nextRetryAt: string | null;
  lastError: string | null;
  createdAt: string;
  uploadedAt: string | null;
}

export interface CreateReportInput {
  id: string;
  description: string;
  images: Omit<ReportImage, 'reportId'>[];
}