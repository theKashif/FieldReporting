import { Request, Response } from 'express';
import { Report } from '../models/Report';
import { createReport } from '../services/reportService';
import { deleteFiles } from '../utils/cleanup';

export async function createReportController(
    req: Request,
    res: Response,
): Promise<void> {
    const files = (req.files as Express.Multer.File[]) || [];

    try {
        const reportId = String(req.body.reportId || '').trim();
        const description = String(req.body.description || '').trim();

        if (!reportId) {
            await deleteFiles(files.map(file => file.path));
            res.status(400).json({ message: 'reportId is required.' });
            return;
        }

        if (!description) {
            await deleteFiles(files.map(file => file.path));
            res.status(400).json({ message: 'Description is required.' });
            return;
        }

        if (files.length < 1 || files.length > 5) {
            await deleteFiles(files.map(file => file.path));
            res.status(400).json({
                message: 'A report must contain between 1 and 5 images.',
            });
            return;
        }

        const result = await createReport({
            reportId,
            description,
            files,
        });

        res.status(result.duplicate ? 200 : 201).json({
            message: result.duplicate
                ? 'Report was already received.'
                : 'Report uploaded successfully.',
            duplicate: result.duplicate,
            report: result.report,
        });
    } catch (error) {
        console.error('Create report error:', error);

        res.status(500).json({
            message: 'Unable to save report. Please retry.',
        });
    }
}

export async function getReportsController(
    _req: Request,
    res: Response,
): Promise<void> {
    try {
        const reports = await Report.find().sort({ createdAt: -1 }).lean();

        res.json({ reports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ message: 'Unable to fetch reports.' });
    }
}