import fs from 'fs';
import path from 'path';
import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { Report } from '../models/Report';
import { createReport } from '../services/reportService';
import { deleteFiles } from '../utils/cleanup';

function getMimeTypeFromFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.webp':
            return 'image/webp';
        case '.gif':
            return 'image/gif';
        default:
            return 'image/jpeg';
    }
}

export function formatReportImage(req: Request, img: any) {
    let size = typeof img.size === 'number' && img.size > 0 ? img.size : 0;
    if (size === 0 && img.filename) {
        try {
            const filePath = path.join(process.cwd(), 'uploads', img.filename);
            if (fs.existsSync(filePath)) {
                size = fs.statSync(filePath).size;
            }
        } catch {
            // fallback if file stats cannot be read
        }
    }

    const mimeType =
        img.mimeType ||
        getMimeTypeFromFilename(img.filename || img.originalName || '');

    const protocol = req.protocol;
    const host = req.get('host');
    const url = host
        ? `${protocol}://${host}/uploads/${encodeURIComponent(img.filename)}`
        : `/uploads/${encodeURIComponent(img.filename)}`;

    return {
        filename: img.filename,
        originalName: img.originalName,
        mimeType,
        size,
        url: img.url || url,
    };
}

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

        const reportObj =
            typeof (result.report as any).toObject === 'function'
                ? (result.report as any).toObject()
                : result.report;

        const formattedReport = {
            ...reportObj,
            images: (reportObj.images || []).map((img: any) =>
                formatReportImage(req, img),
            ),
        };

        res.status(result.duplicate ? 200 : 201).json({
            message: result.duplicate
                ? 'Report was already received.'
                : 'Report uploaded successfully.',
            duplicate: result.duplicate,
            report: formattedReport,
        });
    } catch (error) {
        console.error('Create report error:', error);

        res.status(500).json({
            message: 'Unable to save report. Please retry.',
        });
    }
}

export async function getReportsController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const reports = await Report.find().sort({ createdAt: -1 }).lean();

        const formattedReports = reports.map(report => ({
            ...report,
            images: (report.images || []).map((img: any) =>
                formatReportImage(req, img),
            ),
        }));

        res.json({ reports: formattedReports });
    } catch (error) {
        console.error('Get reports error:', error);
        res.status(500).json({ message: 'Unable to fetch reports.' });
    }
}

export async function getReportByIdController(
    req: Request,
    res: Response,
): Promise<void> {
    try {
        const { id } = req.params;
        const report = await Report.findOne({
            $or: [
                ...(mongoose.isValidObjectId(id) ? [{ _id: id }] : []),
                { reportId: id },
            ],
        }).lean();

        if (!report) {
            res.status(404).json({ message: 'Report not found.' });
            return;
        }

        const formattedReport = {
            ...report,
            images: (report.images || []).map((img: any) =>
                formatReportImage(req, img),
            ),
        };

        res.json({ report: formattedReport });
    } catch (error) {
        console.error('Get report by ID error:', error);
        res.status(500).json({ message: 'Unable to fetch report.' });
    }
}


export async function resetReportsController(
    _req: Request,
    res: Response,
): Promise<void> {
    try {
        await Report.deleteMany({});

        const uploadsDir = path.join(process.cwd(), 'uploads');
        if (fs.existsSync(uploadsDir)) {
            const entries = fs.readdirSync(uploadsDir);
            for (const entry of entries) {
                if (entry !== 'temp' && entry !== '.gitkeep') {
                    const fullPath = path.join(uploadsDir, entry);
                    try {
                        if (fs.statSync(fullPath).isFile()) {
                            fs.unlinkSync(fullPath);
                        }
                    } catch (e) {
                        console.warn('Failed to delete upload file during reset:', entry, e);
                    }
                }
            }
        }

        res.json({ message: 'All reports and files on the server have been reset.' });
    } catch (error) {
        console.error('Reset reports error:', error);
        res.status(500).json({ message: 'Unable to reset reports.' });
    }
}
