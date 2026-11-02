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
    WHERE status IN ('pending', 'uploading', 'failed')
    ORDER BY created_at DESC;
  `);

  return result.rows as unknown as Report[];
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

  return result.rows as unknown as ReportImage[];
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

  return result.rows as unknown as Report[];
}


export async function getNextPendingReport(): Promise<Report | null> {
  const now = new Date().toISOString();

  const result = await db.execute(
    `SELECT
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
      AND (next_retry_at IS NULL OR next_retry_at <= ?)
    ORDER BY created_at ASC
    LIMIT 1`,
    [now],
  );

  return (result.rows[0] as unknown as Report | undefined) ?? null;
}

export async function markReportUploading(id: string): Promise<void> {
  await db.execute(
    `UPDATE reports
     SET status = 'uploading', updated_at = ?
     WHERE id = ?`,
    [new Date().toISOString(), id],
  );
}

export async function markReportUploaded(id: string): Promise<void> {
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE reports
     SET status = 'uploaded',
         uploaded_at = ?,
         updated_at = ?,
         next_retry_at = NULL,
         last_error = NULL
     WHERE id = ?`,
    [now, now, id],
  );
}

export async function scheduleReportRetry(
  id: string,
  errorMessage: string,
  nextRetryAt: string,
): Promise<void> {
  await db.execute(
    `UPDATE reports
     SET status = 'pending',
         retry_count = retry_count + 1,
         next_retry_at = ?,
         last_error = ?,
         updated_at = ?
     WHERE id = ?`,
    [nextRetryAt, errorMessage, new Date().toISOString(), id],
  );
}

export async function markReportFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  const now = new Date().toISOString();

  await db.execute(
    `UPDATE reports
     SET status = 'failed',
         retry_count = retry_count + 1,
         next_retry_at = NULL,
         last_error = ?,
         updated_at = ?
     WHERE id = ?`,
    [errorMessage, now, id],
  );
}

export async function recoverInterruptedUploads(): Promise<void> {
  await db.execute(
    `UPDATE reports
     SET status = 'pending',
         next_retry_at = NULL,
         updated_at = ?
     WHERE status = 'uploading'`,
    [new Date().toISOString()],
  );
}

export async function getNextRetryTime(): Promise<string | null> {
  const result = await db.execute(
    `SELECT MIN(next_retry_at) AS nextRetryAt
     FROM reports
     WHERE status = 'pending'
       AND next_retry_at IS NOT NULL`,
  );

  return (result.rows[0] as {nextRetryAt: string | null})?.nextRetryAt ?? null;
}

export async function makeNetworkRetriesEligible(): Promise<void> {
  await db.execute(
    `UPDATE reports
     SET next_retry_at = NULL,
         updated_at = ?
     WHERE status = 'pending'
       AND (
         last_error LIKE '%Network%'
         OR last_error LIKE '%network%'
         OR last_error LIKE '%timed out%'
       )`,
    [new Date().toISOString()],
  );
}

export async function deleteReport(
  reportId: string,
): Promise<string[]> {
  const images = await getReportImages(reportId);

  await db.execute(
    'DELETE FROM reports WHERE id = ?',
    [reportId],
  );

  return images.map(image => image.uri);
}

export async function deleteOldUploadedReports(): Promise<string[]> {
  const result = await db.execute(`
    SELECT uri
    FROM report_images
    WHERE report_id IN (
      SELECT id FROM reports WHERE status = 'uploaded'
    );
  `);

  await db.execute(`
    DELETE FROM reports
    WHERE status = 'uploaded';
  `);

  return result.rows.map(
    (row: any) => row.uri as string,
  );
}


export async function clearAllLocalData(): Promise<void> {
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM report_images;');
    await tx.execute('DELETE FROM reports;');
  });
}
