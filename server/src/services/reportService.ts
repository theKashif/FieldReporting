import fs from 'fs/promises';
import path from 'path';
import {randomUUID} from 'crypto';
import {Report, IReport} from '../models/Report';
import {deleteFiles, getUploadPath} from '../utils/cleanup';

interface CreateReportData {
  reportId: string;
  description: string;
  files: Express.Multer.File[];
}

export async function createReport(
  data: CreateReportData,
): Promise<{report: IReport; duplicate: boolean}> {
  const {reportId, description, files} = data;

  // A retry may arrive after the original request was already saved.
  const existing = await Report.findOne({reportId});

  if (existing) {
    await deleteFiles(files.map(file => file.path));
    return {report: existing, duplicate: true};
  }

  const movedFiles: string[] = [];

  try {
    const images = [];

    for (const file of files) {
      const filename = `${randomUUID()}${path.extname(file.originalname) || '.jpg'}`;
      const destination = getUploadPath(filename);

      await fs.rename(file.path, destination);
      movedFiles.push(destination);

      images.push({
        filename,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
      });
    }

    const report = await Report.create({
      reportId,
      description,
      images,
    });

    return {report, duplicate: false};
  } catch (error: any) {
    // If another request won the race, return its saved report.
    if (error?.code === 11000) {
      await deleteFiles(movedFiles);

      const existingReport = await Report.findOne({reportId});

      if (existingReport) {
        return {report: existingReport, duplicate: true};
      }
    }

    await deleteFiles([
      ...movedFiles,
      ...files.map(file => file.path),
    ]);

    throw error;
  }
}