
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import {
  Asset,
  launchCamera,
  launchImageLibrary,
} from 'react-native-image-picker';

import { initializeDatabase } from '../database/schema';
import {
  getAllReports,
  getReportImages,
  clearAllLocalData,
} from '../repositories/reportRepository';

import { Report, ReportImage } from '../types/report';
import { saveReport } from '../services/reportService';
import { clearAllStoredImages } from '../services/imageStorageService';

import {
  startUploadQueueWorker,
  wakeUploadQueue,
} from '../workers/uploadQueueWorker';

import {
  fetchServerReports,
  resetServerReports,
  ServerReport,
} from '../services/reportApiService';

import ReportImageItem from '../components/ReportImageItem';
import ImagePreviewModal from '../components/ImagePreviewModal';
import ChaosControlPanel from '../components/ChaosControlPanel';

const MAX_IMAGES = 5;

type SavedReport = Report & {
  images: ReportImage[];
};

type PreviewImage = {
  uri: string;
  size?: number | null;
  mimeType?: string | null;
};

export default function CreateReportScreen() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Asset[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [serverReports, setServerReports] = useState<ServerReport[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [selectedImage, setSelectedImage] =
    useState<PreviewImage | null>(null);


  const loadReports = useCallback(async () => {
    try {
      await initializeDatabase();

      // 1. Load only local reports awaiting delivery.
      const savedReports = await getAllReports();

      const reportsWithImages = await Promise.all(
        savedReports.map(async report => ({
          ...report,
          images: await getReportImages(report.id),
        })),
      );

      setReports(reportsWithImages);
    } catch (error) {
      console.error('Failed to load local reports:', error);
    }

    try {
      // 2. Fetch submitted reports from the backend.
      const submittedReports = await fetchServerReports();

      setServerReports(submittedReports);
      setServerError(null);
    } catch (error) {
      console.error('Failed to fetch server reports:', error);

      // Keep the last successfully fetched list in memory.
      setServerError('Unable to refresh submitted reports. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = async () => {
    setRefreshing(true);

    try {
      await loadReports();
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const stopWorker = startUploadQueueWorker(loadReports);

    return stopWorker;
  }, [loadReports]);

  const addImages = (newImages: Asset[]) => {
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
  };

  const openGallery = async () => {
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

    if (response.didCancel) {
      return;
    }


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
  };

  const openCamera = async () => {
    if (images.length >= MAX_IMAGES) {
      Alert.alert('Image limit', 'Maximum 5 images are allowed.');
      return;
    }

    const response = await launchCamera({
      mediaType: 'photo',
      quality: 1,
      saveToPhotos: false,
    });

    if (response.didCancel) {
      return;
    }

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
  };

  const removeImage = (uri?: string) => {
    setImages(current => current.filter(image => image.uri !== uri));
  };

  const handleSaveReport = async () => {
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

      // Start uploading immediately if a network is available.
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
  };

  const handleReset = () => {
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
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
        />
      }>
      <Text style={styles.heading}>Create Report</Text>
      <Text style={styles.subtitle}>
        Reports are saved locally and can be uploaded later.
      </Text>

      <ChaosControlPanel />

      <Text style={styles.label}>Description</Text>

      <TextInput
        style={styles.input}
        placeholder="Describe what you found..."
        placeholderTextColor="#888"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      <Text style={styles.counter}>
        {description.length}/500 characters
      </Text>

      <View style={styles.imageHeader}>
        <Text style={styles.label}>Attachments</Text>
        <Text style={styles.counter}>{images.length}/5 images</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity style={styles.actionButton} onPress={openCamera}>
          <Text style={styles.actionText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={openGallery}>
          <Text style={styles.actionText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.imageGrid}>
        {images.map((image, index) => (
          <ReportImageItem
            key={image.uri || String(index)}
            uri={image.uri!}
            size={image.fileSize}
            mimeType={image.type}
            onPress={() =>
              setSelectedImage({
                uri: image.uri!,
                size: image.fileSize,
                mimeType: image.type,
              })
            }
            onRemove={() => removeImage(image.uri)}
          />
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={handleSaveReport}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Report</Text>
        )}
      </TouchableOpacity>

      <View style={styles.savedSection}>
        {/* Local queue */}
        <Text style={styles.sectionHeading}>
          Pending Uploads ({reports.length})
        </Text>

        <Text style={styles.sectionDescription}>
          Reports saved on this device that haven't been confirmed by the server.
        </Text>

        {loading ? (
          <ActivityIndicator />
        ) : reports.length === 0 ? (
          <Text style={styles.emptyText}>
            No pending uploads.
          </Text>
        ) : (
          reports.map(report => (
            <View key={report.id} style={styles.reportCard}>
              <Text style={styles.reportDescription}>
                {report.description}
              </Text>

              <Text style={styles.reportMeta}>
                {report.status === 'uploading'
                  ? '↑ Uploading...'
                  : report.status === 'failed'
                    ? `✕ Failed: ${report.lastError || 'Unknown error'}`
                    : '● Saved locally · Waiting to upload'}
                {' · '}
                {report.images.length} images
              </Text>

              <View style={styles.savedImageGrid}>
                {report.images.map(image => (
                  <ReportImageItem
                    key={image.id}
                    uri={image.uri}
                    size={image.size}
                    mimeType={image.mimeType}
                    status="Saved locally"
                    onPress={() =>
                      setSelectedImage({
                        uri: image.uri,
                        size: image.size,
                        mimeType: image.mimeType,
                      })
                    }
                  />
                ))}
              </View>
            </View>
          ))
        )}

        {/* Server reports */}
        <View style={styles.serverSection}>
          <Text style={styles.sectionHeading}>
            Submitted Reports ({serverReports.length})
          </Text>

          <Text style={styles.sectionDescription}>
            Reports successfully received by the server.
          </Text>

          {serverError && (
            <Text style={styles.errorText}>
              {serverError}
            </Text>
          )}

          {!loading && serverReports.length === 0 ? (
            <Text style={styles.emptyText}>
              No reports have been submitted yet.
            </Text>
          ) : (
            serverReports.map(report => (
              <View key={report.reportId} style={styles.reportCard}>
                <Text style={styles.reportDescription}>
                  {report.description}
                </Text>

                <Text style={styles.reportMeta}>
                  ✓ Submitted successfully
                  {' · '}
                  {report.images.length} images
                </Text>

                <Text style={styles.reportMeta}>
                  {new Date(report.createdAt).toLocaleString()}
                </Text>

                <Text style={styles.reportMeta}>
                  ID: {report.reportId}
                </Text>

                <View style={styles.savedImageGrid}>
                  {report.images.map((image, index) => (
                    <ReportImageItem
                      key={image.filename || String(index)}
                      uri={image.url}
                      size={image.size}
                      mimeType={image.mimeType}
                      status="Uploaded"
                      onPress={() =>
                        setSelectedImage({
                          uri: image.url,
                          size: image.size,
                          mimeType: image.mimeType,
                        })
                      }
                    />
                  ))}
                </View>
              </View>
            ))
          )}
        </View>
      </View>

        <View style={styles.resetSection}>
          <Text style={styles.resetHeading}>Start Over</Text>
          <Text style={styles.resetDescription}>
            A deliberate reset to test the delivery pipeline or discard pending state.
          </Text>
          <TouchableOpacity
            style={[styles.resetButton, (resetting || saving) && styles.disabledButton]}
            onPress={handleReset}
            disabled={resetting || saving}>
            {resetting ? (
              <ActivityIndicator color="#D22F3F" />
            ) : (
              <Text style={styles.resetButtonText}>Start Over / Reset Pipeline</Text>
            )}
          </TouchableOpacity>
        </View>

      <ImagePreviewModal
        visible={!!selectedImage}
        imageUri={selectedImage?.uri ?? null}
        size={selectedImage?.size}
        mimeType={selectedImage?.mimeType}
        onClose={() => setSelectedImage(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  content: { padding: 20, paddingTop: 40 },
  heading: { fontSize: 26, fontWeight: '700', color: '#172033' },
  subtitle: { fontSize: 14, color: '#687386', marginTop: 6, marginBottom: 28 },
  label: { fontSize: 15, fontWeight: '600', color: '#172033', marginBottom: 10 },
  input: {
    minHeight: 120,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDE2EA',
    borderRadius: 12,
    padding: 14,
    color: '#172033',
    fontSize: 15,
  },
  counter: { color: '#8490A1', fontSize: 12 },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
  },
  actions: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    backgroundColor: '#E8EEFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: { color: '#2855C5', fontWeight: '600' },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 20,
  },
  imageWrapper: { width: '30%', aspectRatio: 1, position: 'relative' },
  image: {
    width: '100%',
    height: '100%',
    borderRadius: 10,
    backgroundColor: '#E1E5EC',
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    backgroundColor: '#FFFFFF',
    width: 25,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontSize: 20, lineHeight: 23, color: '#D22F3F' },
  imageSize: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    color: '#FFFFFF',
    fontSize: 10,
    backgroundColor: '#00000099',
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  saveButton: {
    backgroundColor: '#2855C5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 25,
  },
  disabledButton: { opacity: 0.6 },
  saveButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  savedSection: { marginTop: 35 },
  sectionHeading: { fontSize: 20, fontWeight: '700', color: '#172033', marginBottom: 15 },
  emptyText: { color: '#8490A1', paddingVertical: 15 },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E8EF',
  },
  reportDescription: { fontSize: 15, fontWeight: '600', color: '#172033' },
  reportMeta: { fontSize: 12, color: '#718096', marginTop: 6 },

  savedImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
  savedImage: { width: 65, height: 65, borderRadius: 8 },
  sectionDescription: {
    color: '#8490A1',
    fontSize: 12,
    marginTop: -8,
    marginBottom: 15,
  },

  serverSection: {
    marginTop: 30,
  },

  resetSection: {
    marginTop: 30,
    marginBottom: 40,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#FFF5F5',
    borderWidth: 1,
    borderColor: '#FED7D7',
  },
  resetHeading: {
    fontSize: 18,
    fontWeight: '700',
    color: '#C53030',
  },
  resetDescription: {
    fontSize: 13,
    color: '#742A2A',
    marginTop: 4,
    marginBottom: 14,
  },
  resetButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E53E3E',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#E53E3E',
    fontWeight: '700',
    fontSize: 14,
  },
  errorText: {
    color: '#D22F3F',
    fontSize: 13,
    marginBottom: 12,
  },
});
