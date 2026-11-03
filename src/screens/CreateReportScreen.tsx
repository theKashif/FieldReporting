import React, { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
} from 'react-native';

import {
  Asset,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

import { clearAllLocalData } from '../repositories/reportRepository';
import { clearAllStoredImages } from '../services/imageStorageService';
import { saveReport } from '../services/reportService';
import { resetServerReports } from '../services/reportApiService';
import { wakeUploadQueue } from '../workers/uploadQueueWorker';
import { PreviewImage } from '../types/report';

import { useReports } from '../hooks/useReports';
import ChaosControlPanel from '../components/ChaosControlPanel';
import ReportComposeForm from '../components/ReportComposeForm';
import PendingReportsList from '../components/PendingReportsList';
import SubmittedReportsList from '../components/SubmittedReportsList';
import StartOverSection from '../components/StartOverSection';
import ImagePreviewModal from '../components/ImagePreviewModal';

const MAX_IMAGES = 5;

export default function CreateReportScreen() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Asset[]>([]);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<PreviewImage | null>(null);

  const {
    localReports,
    serverReports,
    loading,
    refreshing,
    serverError,
    loadReports,
    handleRefresh,
  } = useReports();

  const addImages = useCallback((newImages: Asset[]) => {
    setImages(current => {
      const combined = [...current, ...newImages];
      const unique = combined.filter(
        (image, index, array) =>
          !!image.uri &&
          array.findIndex(item => item.uri === image.uri) === index,
      );

      if (unique.length > MAX_IMAGES) {
        Alert.alert('Image limit', 'Maximum 5 images are allowed.');
      }

      return unique.slice(0, MAX_IMAGES);
    });
  }, []);

  const openGallery = useCallback(async () => {
    const remaining = MAX_IMAGES - images.length;
    if (remaining <= 0) {
      Alert.alert('Image limit', 'Maximum 5 images are allowed.');
      return;
    }

    const response = await launchImageLibrary({
      mediaType: 'photo',
      selectionLimit: remaining,
      quality: 1,
    });

    if (response.didCancel) return;

    if (response.errorCode) {
      if (response.errorCode === 'permission') {
        Alert.alert(
          'Gallery permission required',
          'Allow photo access in Settings and try again.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Linking.openSettings() },
          ],
        );
        return;
      }
      Alert.alert('Gallery error', response.errorMessage || response.errorCode);
      return;
    }

    if (response.assets) {
      addImages(response.assets);
    }
  }, [images.length, addImages]);

  const openCamera = useCallback(async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Image limit', 'Maximum 5 images are allowed.');
      return;
    }

    const response = await launchCamera({
      mediaType: 'photo',
      quality: 1,
      saveToPhotos: false,
    });

    if (response.didCancel) return;

    if (response.errorCode === 'permission') {
      Alert.alert(
        'Camera permission required',
        'Allow camera access in Settings and try again.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }

    if (response.errorCode) {
      Alert.alert('Camera error', response.errorMessage || response.errorCode);
      return;
    }

    if (response.assets) {
      addImages(response.assets);
    }
  }, [images.length, addImages]);

  const removeImage = useCallback((uri?: string) => {
    setImages(current => current.filter(image => image.uri !== uri));
  }, []);

  const handleSaveReport = useCallback(async () => {
    if (!description.trim()) {
      Alert.alert('Description required', 'Please describe the report.');
      return;
    }

    if (images.length === 0) {
      Alert.alert('Images required', 'Please attach at least one image.');
      return;
    }

    if (images.length > MAX_IMAGES) {
      Alert.alert('Image limit', 'Maximum 5 images are allowed.');
      return;
    }

    try {
      setSaving(true);
      await saveReport(description, images);

      setDescription('');
      setImages([]);
      await loadReports();

      // Trigger immediate upload processing
      wakeUploadQueue();
      Alert.alert('Saved', 'Your report has been saved on this device.');
    } catch (error) {
      console.error('Report save error:', error);
      Alert.alert(
        'Unable to save report',
        error instanceof Error ? error.message : 'Something went wrong.',
      );
    } finally {
      setSaving(false);
    }
  }, [description, images, loadReports]);

  const handleReset = useCallback(() => {
    Alert.alert(
      'Start Over',
      'Choose the reset scope (blast radius):\n\n' +
        '• Local Queue Only: Clears local pending uploads and compressed cache on this phone.\n\n' +
        '• Full Reset: Clears phone data AND deletes all reports and uploaded photos from the server.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Local Queue Only',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              await clearAllLocalData();
              await clearAllStoredImages();
              setDescription('');
              setImages([]);
              await loadReports();
              Alert.alert(
                'Reset Complete',
                'Local pending queue and cached photos have been wiped.',
              );
            } catch (err) {
              Alert.alert(
                'Reset Failed',
                err instanceof Error ? err.message : 'Unknown error',
              );
            } finally {
              setResetting(false);
            }
          },
        },
        {
          text: 'Full Reset (Local + Server)',
          style: 'destructive',
          onPress: async () => {
            try {
              setResetting(true);
              await clearAllLocalData();
              await clearAllStoredImages();
              await resetServerReports();
              setDescription('');
              setImages([]);
              await loadReports();
              Alert.alert(
                'Reset Complete',
                'Local queue and server reports have been cleared.',
              );
            } catch (err) {
              Alert.alert(
                'Reset Failed',
                err instanceof Error ? err.message : 'Unknown error',
              );
            } finally {
              setResetting(false);
            }
          },
        },
      ],
    );
  }, [loadReports]);

  const handleSelectImage = useCallback((preview: PreviewImage) => {
    setSelectedImage(preview);
  }, []);

  const handleClosePreview = useCallback(() => {
    setSelectedImage(null);
  }, []);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
      }>
      <Text style={styles.heading}>Create Report</Text>
      <Text style={styles.subtitle}>
        Reports are saved locally and can be uploaded later.
      </Text>

      <ChaosControlPanel />

      <ReportComposeForm
        description={description}
        onChangeDescription={setDescription}
        images={images}
        saving={saving}
        onOpenCamera={openCamera}
        onOpenGallery={openGallery}
        onRemoveImage={removeImage}
        onSelectImage={handleSelectImage}
        onSaveReport={handleSaveReport}
      />

      <PendingReportsList
        reports={localReports}
        loading={loading}
        onSelectImage={handleSelectImage}
      />

      <SubmittedReportsList
        serverReports={serverReports}
        serverError={serverError}
        loading={loading}
        onSelectImage={handleSelectImage}
      />

      <StartOverSection
        onReset={handleReset}
        resetting={resetting}
        disabled={resetting || saving}
      />

      <ImagePreviewModal
        visible={!!selectedImage}
        imageUri={selectedImage?.uri ?? null}
        size={selectedImage?.size}
        mimeType={selectedImage?.mimeType}
        onClose={handleClosePreview}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F8FA',
  },
  content: {
    padding: 20,
    paddingTop: 40,
  },
  heading: {
    fontSize: 26,
    fontWeight: '700',
    color: '#172033',
  },
  subtitle: {
    fontSize: 14,
    color: '#687386',
    marginTop: 6,
    marginBottom: 20,
  },
});
