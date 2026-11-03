import { useCallback, useEffect, useState } from 'react';
import { initializeDatabase } from '../database/schema';
import {
  getAllReports,
  getReportImages,
} from '../repositories/reportRepository';
import {
  fetchServerReports,
  ServerReport,
} from '../services/reportApiService';
import { startUploadQueueWorker } from '../workers/uploadQueueWorker';
import { SavedReport } from '../types/report';

export function useReports() {
  const [localReports, setLocalReports] = useState<SavedReport[]>([]);
  const [serverReports, setServerReports] = useState<ServerReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    try {
      await initializeDatabase();

      // 1. Load local reports awaiting delivery from SQLite
      const savedReports = await getAllReports();
      const reportsWithImages = await Promise.all(
        savedReports.map(async report => ({
          ...report,
          images: await getReportImages(report.id),
        })),
      );
      setLocalReports(reportsWithImages);
    } catch (error) {
      console.error('Failed to load local reports:', error);
    }

    try {
      // 2. Fetch submitted reports directly from server
      const submittedReports = await fetchServerReports();
      setServerReports(submittedReports);
      setServerError(null);
    } catch (error) {
      console.error('Failed to fetch server reports:', error);
      setServerError('Unable to refresh submitted reports. Check your connection.');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await loadReports();
    } finally {
      setRefreshing(false);
    }
  }, [loadReports]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  useEffect(() => {
    const stopWorker = startUploadQueueWorker(loadReports);
    return stopWorker;
  }, [loadReports]);

  return {
    localReports,
    serverReports,
    loading,
    refreshing,
    serverError,
    loadReports,
    handleRefresh,
  };
}

