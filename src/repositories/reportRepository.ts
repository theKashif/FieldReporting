import { db } from '../database/database';
import {
  CreateReportInput,
  Report,
  ReportImage,
} from '../types/report';

export async function createReport(
  input: CreateReportInput,
): Promise<void> {
  const now = new Date().toISOString();

  await db.transaction(async tx => {
    await tx.execute(
      `INSERT INTO reports (
        id,
        description,
        status,
        created_at,
        updated_at
      ) VALUES (?, ?, 'pending', ?, ?)`,
      [input.id, input.description, now, now],
    );

    for (const image of input.images) {
      await tx.execute(
        `INSERT INTO report_images (
          id,
          report_id,
          uri,
          size,
          mime_type
        ) VALUES (?, ?, ?, ?, ?)`,
        [
          image.id,
          input.id,
          image.uri,
          image.size,
          image.mimeType,
        ],
      );
    }
  });
}

export async function getAllReports(): Promise<Report[]> {
  const result = await db.execute(`
    SELECT
      id,
      description,
      status,
      retry_count AS retryCount,
      next_retry_at AS nextRetryAt,
      last_error AS lastError,
      created_at AS createdAt,
      uploaded_at AS uploadedAt
    FROM reports
    ORDER BY created_at DESC;
  `);

  return result.rows as Report[];
}

export async function getReportImages(
  reportId: string,
): Promise<ReportImage[]> {
  const result = await db.execute(
    `SELECT
      id,
      report_id AS reportId,
      uri,
      size,
      mime_type AS mimeType
    FROM report_images
    WHERE report_id = ?`,
    [reportId],
  );

  return result.rows as ReportImage[];
}

export async function getPendingReports(): Promise<Report[]> {
  const result = await db.execute(`
    SELECT
      id,
      description,
      status,
      retry_count AS retryCount,
      next_retry_at AS nextRetryAt,
      last_error AS lastError,
      created_at AS createdAt,
      uploaded_at AS uploadedAt
    FROM reports
    WHERE status = 'pending'
    ORDER BY created_at ASC;
  `);

  return result.rows as Report[];
}