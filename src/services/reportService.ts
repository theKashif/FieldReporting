import { Asset } from 'react-native-image-picker';

import { createReport } from '../repositories/reportRepository';
import {
  deleteStoredImages,
  processAndStoreImage,
  StoredImage,
} from './imageStorageService';

const MAX_IMAGES = 5;

function createReportId() {
  return `report-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export async function saveReport(
  description: string,
  assets: Asset[],
): Promise<void> {
  const cleanDescription = description.trim();

  if (!cleanDescription) {
    throw new Error('Please enter a report description.');
  }

  if (assets.length < 1 || assets.length > MAX_IMAGES) {
    throw new Error('A report must contain between 1 and 5 images.');
  }

  const storedImages: StoredImage[] = [];

  try {
    // Process images sequentially to manage memory on lower-end devices.
    for (const asset of assets) {
      if (!asset.uri) {
        throw new Error('One of the selected images is invalid.');
      }

      console.log('PROCESSING IMAGE:', {
        uri: asset.uri,
        originalSize: asset.fileSize
          ? `${(asset.fileSize / 1024 / 1024).toFixed(2)} MB`
          : 'Unknown',
      });

      // Compress and store permanently under the 5 MB limit.
      const storedImage = await processAndStoreImage(asset.uri);
      storedImages.push(storedImage);

      console.log('STORED COMPRESSED IMAGE:', {
        id: storedImage.id,
        uri: storedImage.uri,
        sizeMB: (storedImage.size / 1024 / 1024).toFixed(2),
      });
    }

    await createReport({
      id: createReportId(),
      description: cleanDescription,
      images: storedImages,
    });
  } catch (error) {
    // If processing or database insertion fails,
    // clean up any physical files already created for this report.
    await deleteStoredImages(storedImages.map(image => image.uri));

    throw error;
  }
}
