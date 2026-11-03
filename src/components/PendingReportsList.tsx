import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReportImageItem from './ReportImageItem';
import { PreviewImage, SavedReport } from '../types/report';

interface PendingReportsListProps {
  reports: SavedReport[];
  loading: boolean;
  onSelectImage: (preview: PreviewImage) => void;
}

function PendingReportsListComponent({
  reports,
  loading,
  onSelectImage,
}: PendingReportsListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>
        Pending Uploads ({reports.length})
      </Text>

      <Text style={styles.sectionDescription}>
        Reports saved on this device that haven't been confirmed by the server.
      </Text>

      {loading ? (
        <ActivityIndicator style={styles.loader} color="#2855C5" />
      ) : reports.length === 0 ? (
        <Text style={styles.emptyText}>No pending uploads.</Text>
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
                    onSelectImage({
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
    </View>
  );
}

export const PendingReportsList = memo(PendingReportsListComponent);
export default PendingReportsList;

const styles = StyleSheet.create({
  container: {
    marginTop: 30,
  },
  sectionHeading: {
    fontSize: 20,
    fontWeight: '700',
    color: '#172033',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#8490A1',
    fontSize: 12,
    marginBottom: 15,
  },
  loader: {
    paddingVertical: 20,
  },
  emptyText: {
    color: '#8490A1',
    paddingVertical: 15,
  },
  reportCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E8EF',
  },
  reportDescription: {
    fontSize: 15,
    fontWeight: '600',
    color: '#172033',
  },
  reportMeta: {
    fontSize: 12,
    color: '#718096',
    marginTop: 6,
  },
  savedImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
});
