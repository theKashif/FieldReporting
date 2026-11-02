import {API_REPORTS_URL} from '../config/api';
import {Report, ReportImage} from '../types/report';

export class UploadError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
  ) {
    super(message);
    this.name = 'UploadError';
  }

  get retryable(): boolean {
    if (this.statusCode === undefined) {
      return true;
    }

    return (
      this.statusCode === 408 ||
      this.statusCode === 425 ||
      this.statusCode === 429 ||
      this.statusCode >= 500
    );
  }
}

export async function uploadReportToServer(
  report: Report,
  images: ReportImage[],
): Promise<void> {
  if (images.length < 1 || images.length > 5) {
    throw new UploadError(
      'A report must contain between 1 and 5 images.',
    );
  }

  const formData = new FormData();

  formData.append('reportId', report.id);
  formData.append('description', report.description);

  for (const image of images) {
    formData.append(
      'images',
      {
        uri: image.uri,
        name: `${image.id}.jpg`,
        type: image.mimeType,
      } as any,
    );
  }

  const controller = new AbortController();

  const timeout = setTimeout(
    () => controller.abort(),
    120_000,
  );

  try {
    const response = await fetch(API_REPORTS_URL, {
      method: 'POST',
      body: formData as any,
      signal: controller.signal as any,
    });

    let responseData: any = {};

    try {
      responseData = await response.json();
    } catch {
      // The response will be validated below.
    }

    if (!response.ok) {
      throw new UploadError(
        responseData.message ||
          `Upload failed (${response.status}).`,
        response.status,
      );
    }

    const confirmedReportId = responseData?.report?.reportId;

    if (confirmedReportId !== report.id) {
      throw new UploadError(
        'Server response did not confirm the uploaded report.',
      );
    }

    console.log('REPORT CONFIRMED BY SERVER:', report.id);
  } catch (error) {
    if (error instanceof UploadError) {
      throw error;
    }

    if (controller.signal.aborted) {
      throw new UploadError(
        'Upload timed out. It will be retried.',
      );
    }

    throw new UploadError(
      error instanceof Error
        ? error.message
        : 'Network upload failed.',
    );
  } finally {
    clearTimeout(timeout);
  }
}