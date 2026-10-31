import fs from 'fs/promises';
import path from 'path';

export async function deleteFiles(files: string[]): Promise<void> {
  await Promise.all(
    files.map(async file => {
      try {
        await fs.unlink(file);
      } catch (error) {
        console.warn('File cleanup failed:', file, error);
      }
    }),
  );
}

export function getUploadPath(filename: string): string {
  return path.join(process.cwd(), 'uploads', filename);
}