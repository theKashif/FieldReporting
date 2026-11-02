
import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export interface ReportImageItemProps {
  uri: string;
  size?: number | null;
  mimeType?: string | null;
  status?: string;
  onPress: () => void;
  onRemove?: () => void;
}

export const formatFileSize = (bytes?: number | null): string => {
  if (bytes == null || bytes <= 0) {
    return 'Size unknown';
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

const formatMimeType = (mimeType?: string | null): string => {
  if (!mimeType) return 'Unknown format';

  return mimeType.split('/')[1]?.toUpperCase() || 'Unknown format';
};

const ReportImageItem: React.FC<ReportImageItemProps> = ({
  uri,
  size,
  mimeType,
  status,
  onPress,
  onRemove,
}) => {
  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel="Preview image"
      >
        <Image
          source={{ uri }}
          style={styles.image}
          resizeMode="cover"
        />

        <View style={styles.sizeBadge}>
          <Text style={styles.sizeText}>
            {formatFileSize(size)}
          </Text>
        </View>
      </TouchableOpacity>

      {onRemove && (
        <TouchableOpacity
          style={styles.removeButton}
          onPress={onRemove}
          accessibilityRole="button"
          accessibilityLabel="Remove image"
        >
          <Text style={styles.removeText}>×</Text>
        </TouchableOpacity>
      )}

      <View style={styles.details}>
        <Text style={styles.formatText}>
          {formatMimeType(mimeType)}
        </Text>

        {status ? (
          <Text style={styles.statusText}>{status}</Text>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 100,
    marginRight: 10,
    marginBottom: 12,
  },
  image: {
    width: '100%',
    height: 100,
    borderRadius: 10,
    backgroundColor: '#E1E5EC',
  },
  sizeBadge: {
    position: 'absolute',
    bottom: 6,
    left: 5,
    backgroundColor: '#000000B3',
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRadius: 4,
  },
  sizeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 25,
    height: 25,
    borderRadius: 13,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  removeText: {
    fontSize: 20,
    lineHeight: 23,
    color: '#D22F3F',
  },
  details: {
    marginTop: 5,
  },
  formatText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#344054',
  },
  statusText: {
    fontSize: 10,
    color: '#687386',
    marginTop: 2,
  },
});

export default ReportImageItem;
