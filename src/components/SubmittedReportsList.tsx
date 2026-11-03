import React, { memo } from 'react';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import ReportImageItem from './ReportImageItem';
import { ServerReport } from '../services/reportApiService';
import { PreviewImage } from '../types/report';

interface SubmittedReportsListProps {
  serverReports: ServerReport[];
  serverError: string | null;
  loading: boolean;
  onSelectImage: (preview: PreviewImage) => void;
}

function SubmittedReportsListComponent({
  serverReports,
  serverError,
  loading,
  onSelectImage,
}: SubmittedReportsListProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionHeading}>
        Submitted Reports ({serverReports.length})
      </Text>

      <Text style={styles.sectionDescription}>
        Reports successfully received by the server.
      </Text>

      {serverError && (
        <Text style={styles.errorText}>{serverError}</Text>
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

            <Text style={styles.reportMetaSuccess}>
              ✓ Submitted successfully · {report.images.length} images
            </Text>

            <Text style={styles.reportMeta}>
              {new Date(report.createdAt).toLocaleString()}
            </Text>

            <Text style={styles.reportMetaId}>ID: {report.reportId}</Text>

            <View style={styles.savedImageGrid}>
              {report.images.map((image, index) => (
                <ReportImageItem
                  key={image.filename || String(index)}
                  uri={image.url}
                  size={image.size}
                  mimeType={image.mimeType}
                  status="Uploaded"
                  onPress={() =>
                    onSelectImage({
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
  );
}

export const SubmittedReportsList = memo(SubmittedReportsListComponent);
export default SubmittedReportsList;

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
  errorText: {
    color: '#D22F3F',
    fontSize: 13,
    marginBottom: 12,
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
  reportMetaSuccess: {
    fontSize: 12,
    color: '#2E7D32',
    fontWeight: '600',
    marginTop: 6,
  },
  reportMeta: {
    fontSize: 12,
    color: '#718096',
    marginTop: 4,
  },
  reportMetaId: {
    fontSize: 11,
    color: '#A0AEC0',
    marginTop: 2,
  },
  savedImageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
  },
});
