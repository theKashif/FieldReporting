import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { initializeDatabase } from '../database/schema';

import {
  deleteOldUploadedReports,
  deleteReport,
  getNextPendingReport,
  getNextRetryTime,
  getReportImages,
  makeNetworkRetriesEligible,
  markReportFailed,
  markReportUploading,
  recoverInterruptedUploads,
  scheduleReportRetry,
} from '../repositories/reportRepository';

import { deleteStoredImages } from '../services/imageStorageService';

import {
  UploadError,
  uploadReportToServer,
} from '../services/reportUploadService';

type QueueCallback = () => void;

let activeWake: (() => void) | null = null;

export function wakeUploadQueue(): void {
  activeWake?.();
}

function calculateRetryDelay(retryCount: number): number {
  const baseDelay = 5_000;
  const maxDelay = 60 * 60 * 1000;

  const exponentialDelay = Math.min(
    baseDelay * Math.pow(2, retryCount),
    maxDelay,
  );

  const jitter = 0.8 + Math.random() * 0.4;

  return Math.round(exponentialDelay * jitter);
}

export function startUploadQueueWorker(
  onQueueChanged?: QueueCallback,
): () => void {
  let stopped = false;
  let initialized = false;
  let processing = false;
  let rerunRequested = false;

  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const notify = () => {
    onQueueChanged?.();
  };

  const clearRetryTimer = () => {
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = undefined;
    }
  };

  const scheduleNextWake = async () => {
    clearRetryTimer();

    if (stopped) {
      return;
    }

    const nextRetry = await getNextRetryTime();

    if (!nextRetry || stopped) {
      return;
    }

    const delay = Math.max(
      0,
      new Date(nextRetry).getTime() - Date.now(),
    );

    retryTimer = setTimeout(() => {
      void processQueue();
    }, delay);
  };

  const processQueue = async (): Promise<void> => {
    if (stopped) {
      return;
    }

    if (processing) {
      rerunRequested = true;
      return;
    }

    if (!initialized) {
      return;
    }

    processing = true;

    try {
      const network = await NetInfo.fetch();

      if (
        network.isConnected !== true ||
        network.isInternetReachable === false
      ) {
        console.log('QUEUE: No internet connection.');
        return;
      }

      while (!stopped) {
        const report = await getNextPendingReport();

        if (!report) {
          console.log('QUEUE: No eligible pending reports.');
          break;
        }

        console.log('QUEUE: Starting upload:', report.id);

        await markReportUploading(report.id);
        notify();

        try {
          const images = await getReportImages(report.id);

          await uploadReportToServer(report, images);

          // Server has confirmed the report.
          // Now remove the local queue record.
          const localImageUris = await deleteReport(report.id);

          // Delete the physical image files.
          await deleteStoredImages(localImageUris);

          console.log(
            'QUEUE: Report uploaded and removed locally:',
            report.id,
          );

          notify();
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unknown upload error';

          const retryable =
            error instanceof UploadError
              ? error.retryable
              : true;

          if (retryable) {
            const delay = calculateRetryDelay(
              report.retryCount,
            );

            const nextRetryAt = new Date(
              Date.now() + delay,
            ).toISOString();

            await scheduleReportRetry(
              report.id,
              message,
              nextRetryAt,
            );

            console.log('QUEUE: Retry scheduled:', {
              reportId: report.id,
              nextRetryAt,
              message,
            });
          } else {
            await markReportFailed(
              report.id,
              message,
            );

            console.error(
              'QUEUE: Permanent failure:',
              report.id,
              message,
            );
          }

          notify();
          break;
        }
      }
    } catch (error) {
      console.error('QUEUE: Worker error:', error);
    } finally {
      processing = false;

      if (stopped) {
        return;
      }

      await scheduleNextWake();

      if (rerunRequested) {
        rerunRequested = false;
        void processQueue();
      }
    }
  };

  const wake = () => {
    clearRetryTimer();
    void processQueue();
  };

  activeWake = wake;

  const unsubscribeNetwork = NetInfo.addEventListener(state => {
    console.log('QUEUE: Network changed:', {
      connected: state.isConnected,
      internetReachable: state.isInternetReachable,
    });

    if (
      !initialized ||
      state.isConnected !== true ||
      state.isInternetReachable === false
    ) {
      return;
    }

    void (async () => {
      await makeNetworkRetriesEligible();
      wake();
    })().catch(error => {
      console.error('QUEUE: Network recovery failed:', error);
    });
  });

  const appStateSubscription = AppState.addEventListener(
    'change',
    state => {
      if (state === 'active') {
        console.log('QUEUE: App became active.');
        wake();
      }
    },
  );

  void (async () => {
    try {
      await initializeDatabase();

      // Recover uploads interrupted by app termination.
      await recoverInterruptedUploads();

      // Clean up old records from the previous architecture.
      const oldImageUris = await deleteOldUploadedReports();
      await deleteStoredImages(oldImageUris);

      initialized = true;

      console.log('QUEUE: Initialized successfully.');

      notify();
      await processQueue();
    } catch (error) {
      console.error('QUEUE: Initialization failed:', error);
    }
  })();

  return () => {
    stopped = true;

    clearRetryTimer();

    unsubscribeNetwork();
    appStateSubscription.remove();

    if (activeWake === wake) {
      activeWake = null;
    }
  };
}