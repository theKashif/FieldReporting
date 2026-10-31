
import {Image, getRealPath} from 'react-native-compressor';
import ReactNativeBlobUtil from 'react-native-blob-util';

const fs = ReactNativeBlobUtil.fs;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const IMAGE_DIRECTORY = `${fs.dirs.DocumentDir}/report-images`;

const compressionProfiles = [
  {width: 2560, quality: 0.85},
  {width: 2200, quality: 0.80},
  {width: 1920, quality: 0.75},
  {width: 1600, quality: 0.68},
  {width: 1280, quality: 0.60},
  {width: 1024, quality: 0.50},
];

export interface StoredImage {
  id: string;
  uri: string;
  size: number;
  mimeType: string;
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toFilePath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

async function ensureImageDirectory(): Promise<void> {
  if (!(await fs.exists(IMAGE_DIRECTORY))) {
    await fs.mkdir(IMAGE_DIRECTORY);
  }
}

async function safeDelete(path: string): Promise<void> {
  try {
    const filePath = toFilePath(path);

    if (await fs.exists(filePath)) {
      await fs.unlink(filePath);
    }
  } catch (error) {
    console.warn('Image cleanup failed:', error);
  }
}

export async function processAndStoreImage(
  sourceUri: string,
): Promise<StoredImage> {
  if (!sourceUri) {
    throw new Error('Invalid image URI.');
  }

  await ensureImageDirectory();

  const id = createId();

  // Resolve gallery content URIs into accessible file URIs.
  const resolvedUri = await getRealPath(sourceUri, 'image');

  for (let index = 0; index < compressionProfiles.length; index++) {
    const profile = compressionProfiles[index];

    let compressedUri: string | null = null;

    try {
      compressedUri = await Image.compress(resolvedUri, {
        compressionMethod: 'manual',
        maxWidth: profile.width,
        maxHeight: profile.width,
        quality: profile.quality,
        output: 'jpg',
        returnableOutputType: 'uri',
      });

      const compressedPath = toFilePath(compressedUri);
      const fileInfo = await fs.stat(compressedPath);

      console.log(
        `Compression attempt ${index + 1}:`,
        `${(fileInfo.size / 1024 / 1024).toFixed(2)} MB`,
      );

      if (fileInfo.size <= MAX_IMAGE_SIZE) {
        const destination = `${IMAGE_DIRECTORY}/${id}.jpg`;

        // Copy the compressed image into permanent app storage.
        await fs.cp(compressedPath, destination);

        const finalInfo = await fs.stat(destination);

        // Verify the actual stored file, not just the temporary output.
        if (finalInfo.size > MAX_IMAGE_SIZE) {
          await safeDelete(destination);
          throw new Error('Stored image exceeds the 5 MB limit.');
        }

        await safeDelete(compressedPath);

        return {
          id,
          uri: `file://${destination}`,
          size: finalInfo.size,
          mimeType: 'image/jpeg',
        };
      }

      await safeDelete(compressedPath);
    } catch (error) {
      if (compressedUri) {
        await safeDelete(compressedUri);
      }

      console.warn(`Compression attempt ${index + 1} failed:`, error);

      // Continue with the next profile if compression failed.
      if (index === compressionProfiles.length - 1) {
        throw new Error(
          'Unable to compress this image below 5 MB. Please select another image.',
        );
      }
    }
  }

  throw new Error(
    'Unable to compress this image below the 5 MB limit.',
  );
}

export async function deleteStoredImage(uri: string): Promise<void> {
  await safeDelete(uri);
}

export async function deleteStoredImages(uris: string[]): Promise<void> {
  await Promise.all(uris.map(deleteStoredImage));
}
