
import React from 'react';
import {
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

import { formatFileSize } from './ReportImageItem';

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  size?: number | null;
  mimeType?: string | null;
  title?: string;
  onClose: () => void;
}

const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  size,
  mimeType,
  title = 'Image Preview',
  onClose,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar

        barStyle="light-content"
      />

      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>

          <TouchableOpacity
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close image preview"
          >
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.imageContainer}>
          {imageUri ? (
            <Image
              source={{ uri: imageUri }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          ) : (
            <Text style={styles.errorText}>
              Image unavailable
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.metaText}>
            {formatFileSize(size)}
          </Text>

          <Text style={styles.metaText}>
            {mimeType || 'Unknown format'}
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    height: 60,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: (StatusBar.currentHeight ?? 0) - 15,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#292929',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 27,
    lineHeight: 30,
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  errorText: {
    color: '#FFFFFF',
  },
  footer: {
    minHeight: 65,
    paddingHorizontal: 20,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#333333',
  },
  metaText: {
    color: '#CCCCCC',
    fontSize: 12,
  },
});

export default ImagePreviewModal;
