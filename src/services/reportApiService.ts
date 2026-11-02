import {API_REPORTS_URL} from '../config/api';

const API_BASE_URL = API_REPORTS_URL.replace(
  /\/api\/reports\/?$/,
  '',
);

export interface ServerReportImage {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
}

export interface ServerReport {
  _id: string;
  reportId: string;
  description: string;
  images: ServerReportImage[];
  createdAt: string;
}

interface ReportsResponse {
  reports: (Omit<ServerReport, 'images'> & {
    images: (Omit<ServerReportImage, 'url'> & {url?: string})[];
  })[];
}

export async function fetchServerReports(): Promise<ServerReport[]> {
  const response = await fetch(API_REPORTS_URL, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(
      `Unable to fetch reports (${response.status}).`,
    );
  }

  const data = (await response.json()) as ReportsResponse;

  if (!Array.isArray(data.reports)) {
    throw new Error('Invalid reports response from server.');
  }

  return data.reports.map(report => ({
    _id: report._id,
    reportId: report.reportId,
    description: report.description,
    createdAt: report.createdAt,
    images: (report.images || []).map(image => {
      const mimeType = image.mimeType || 'image/jpeg';
      const size = typeof image.size === 'number' ? image.size : 0;
      return {
        filename: image.filename,
        originalName: image.originalName,
        mimeType,
        size,
        url: image.url || `${API_BASE_URL}/uploads/${encodeURIComponent(
          image.filename,
        )}`,
      };
    }),
  }));
}

export async function resetServerReports(): Promise<void> {
  const response = await fetch(`${API_REPORTS_URL}/reset`, {
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Failed to reset server reports (${response.status}).`);
  }
}

