import multer from 'multer';
import path from 'path';
import fs from 'fs';

const tempDirectory = path.join(process.cwd(), 'uploads', 'temp');

fs.mkdirSync(tempDirectory, {recursive: true});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, tempDirectory);
  },

  filename: (_req, _file, callback) => {
    callback(null, `${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`);
  },
});

export const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 5,
  },
  fileFilter: (_req, file, callback) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return callback(new Error('Only JPEG, PNG and WebP images are allowed.'));
    }

    callback(null, true);
  },
});