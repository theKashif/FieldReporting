import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Asset } from 'react-native-image-picker';
import ReportImageItem from './ReportImageItem';
import { PreviewImage } from '../types/report';

interface ReportComposeFormProps {
  description: string;
  onChangeDescription: (text: string) => void;
  images: Asset[];
  saving: boolean;
  onOpenCamera: () => void;
  onOpenGallery: () => void;
  onRemoveImage: (uri?: string) => void;
  onSelectImage: (preview: PreviewImage) => void;
  onSaveReport: () => void;
}

function ReportComposeFormComponent({
  description,
  onChangeDescription,
  images,
  saving,
  onOpenCamera,
  onOpenGallery,
  onRemoveImage,
  onSelectImage,
  onSaveReport,
}: ReportComposeFormProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>Description</Text>

      <TextInput
        style={styles.input}
        placeholder="Describe what you found..."
        placeholderTextColor="#888"
        value={description}
        onChangeText={onChangeDescription}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />

      <Text style={styles.counter}>{description.length}/500 characters</Text>

      <View style={styles.imageHeader}>
        <Text style={styles.label}>Attachments</Text>
        <Text style={styles.counter}>{images.length}/5 images</Text>
      </View>

      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onOpenCamera}
          disabled={saving}>
          <Text style={styles.actionText}>Take Photo</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={onOpenGallery}
          disabled={saving}>
          <Text style={styles.actionText}>Gallery</Text>
        </TouchableOpacity>
      </View>

      {images.length > 0 && (
        <View style={styles.imageGrid}>
          {images.map((image, index) => (
            <ReportImageItem
              key={image.uri || String(index)}
              uri={image.uri!}
              size={image.fileSize}
              mimeType={image.type}
              onPress={() =>
                onSelectImage({
                  uri: image.uri!,
                  size: image.fileSize,
                  mimeType: image.type,
                })
              }
              onRemove={() => onRemoveImage(image.uri)}
            />
          ))}
        </View>
      )}

      <TouchableOpacity
        style={[styles.saveButton, saving && styles.disabledButton]}
        onPress={onSaveReport}
        disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#FFFFFF" />
        ) : (
          <Text style={styles.saveButtonText}>Save Report</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export const ReportComposeForm = memo(ReportComposeFormComponent);

const styles = StyleSheet.create({
  container: {
    marginBottom: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#172033',
    marginBottom: 10,
  },
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
  counter: {
    color: '#8490A1',
    fontSize: 12,
    marginTop: 4,
  },
  imageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionButton: {
    flex: 1,
    backgroundColor: '#E8EEFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  actionText: {
    color: '#2855C5',
    fontWeight: '600',
  },
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
  },
  saveButton: {
    backgroundColor: '#2855C5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
export default ReportComposeForm;

