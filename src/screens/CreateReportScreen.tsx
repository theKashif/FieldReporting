
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
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
} from '../repositories/reportRepository';

import { Report, ReportImage } from '../types/report';
import { saveReport } from '../services/reportService';

const MAX_IMAGES = 5;

type SavedReport = Report & {
  images: ReportImage[];
};

export default function CreateReportScreen() {
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<Asset[]>([]);
  const [reports, setReports] = useState<SavedReport[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadReports = useCallback(async () => {
    try {
      await initializeDatabase();

      const savedReports = await getAllReports();

      const reportsWithImages = await Promise.all(
        savedReports.map(async report => ({
          ...report,
          images: await getReportImages(report.id),
        })),
      );

      setReports(reportsWithImages);
    } catch (error) {
      console.error('Failed to load reports:', error);
      Alert.alert('Error', 'Unable to load saved reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReports();
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

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}>
      <Text style={styles.heading}>Create Report</Text>
      <Text style={styles.subtitle}>
        Reports are saved locally and can be uploaded later.
      </Text>

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
          <View key={image.uri || String(index)} style={styles.imageWrapper}>
            <Image source={{ uri: image.uri }} style={styles.image} />

            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeImage(image.uri)}>
              <Text style={styles.removeText}>×</Text>
            </TouchableOpacity>

            <Text style={styles.imageSize}>
              {image.fileSize
                ? `${(image.fileSize / 1048576).toFixed(2)} MB`
                : 'Size unknown'}
            </Text>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={handleSaveReport}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Report Offline</Text>
        )}
      </TouchableOpacity>

      <View style={styles.savedSection}>
        <Text style={styles.sectionHeading}>Saved Reports</Text>

        {loading ? (
          <ActivityIndicator />
        ) : reports.length === 0 ? (
          <Text style={styles.emptyText}>No reports saved yet.</Text>
        ) : (
          reports.map(report => (
            <View key={report.id} style={styles.reportCard}>
              <Text style={styles.reportDescription}>
                {report.description}
              </Text>

              <Text style={styles.reportMeta}>
                Saved locally · {report.images.length} images
              </Text>

              <View style={styles.savedImageGrid}>
                {report.images.map(image => {
                  return <>
                    <Image
                      key={image.id}
                      source={{ uri: image.uri }}
                      style={styles.savedImage}
                    />;
                    <Text style={styles.imageSize}>
                      {image.size
                        ? `${(image.size / 1048576).toFixed(2)} MB`
                        : 'Size unknown'}
                    </Text>
                  </>
                })}
              </View>
            </View>
          ))
        )}
      </View>
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
  imageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
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
  savedImageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  savedImage: { width: 65, height: 65, borderRadius: 8 },
});
