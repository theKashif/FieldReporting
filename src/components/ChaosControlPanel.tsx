import React, { useEffect, useState, useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import {
  ChaosConfig,
  ChaosMode,
  fetchChaosConfig,
  setChaosMode,
} from '../services/chaosService';

interface ChaosOption {
  mode: ChaosMode;
  label: string;
  icon: string;
  description: string;
  options?: Partial<ChaosConfig>;
  activeColor: string;
}

const CHAOS_OPTIONS: ChaosOption[] = [
  {
    mode: 'none',
    label: 'Normal (Healthy)',
    icon: '🟢',
    description: 'Server accepts uploads and responds immediately.',
    activeColor: '#2E7D32',
  },
  {
    mode: 'drop',
    label: 'Drop Connection',
    icon: '⚡',
    description: 'Backend forcibly kills TCP socket mid-request.',
    activeColor: '#D32F2F',
  },
  {
    mode: 'error',
    label: '500 Server Error',
    icon: '💥',
    description: 'Backend responds with HTTP 500 Internal Server Error.',
    options: { status: 500, message: 'Simulated backend crash' },
    activeColor: '#E65100',
  },
  {
    mode: 'delay',
    label: '2G Latency (15s)',
    icon: '🐌',
    description: 'Backend introduces 15-second delay to test 2G patience.',
    options: { delayMs: 15000 },
    activeColor: '#F57C00',
  },
  {
    mode: 'rate_limit',
    label: 'Rate Limit (429)',
    icon: '🔒',
    description: 'Backend returns HTTP 429 Too Many Requests.',
    options: { status: 429, message: 'Too many requests - back off' },
    activeColor: '#7B1FA2',
  },
];

export default function ChaosControlPanel() {
  const [currentMode, setCurrentMode] = useState<ChaosMode>('none');
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reachable, setReachable] = useState<boolean | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const config = await fetchChaosConfig();
      setCurrentMode(config.mode);
      setReachable(true);
    } catch {
      setReachable(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleSelectMode = async (option: ChaosOption) => {
    try {
      setLoading(true);
      const updated = await setChaosMode(option.mode, option.options);
      setCurrentMode(updated.mode);
      setReachable(true);
      Alert.alert(
        `Chaos Mode: ${option.label}`,
        `${option.description}\n\nTry saving a report to watch how the upload queue handles this condition!`,
      );
    } catch (err) {
      Alert.alert(
        'Server Unreachable',
        'Could not reach the backend chaos endpoint. Ensure your server is running (npm run dev) and port forwarded (adb reverse tcp:5000 tcp:5000).',
      );
      setReachable(false);
    } finally {
      setLoading(false);
    }
  };

  const activeOption =
    CHAOS_OPTIONS.find(o => o.mode === currentMode) || CHAOS_OPTIONS[0];

  return (
    <View style={styles.card}>
      <TouchableOpacity
        style={styles.headerRow}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>🛠️ Failure & Chaos Simulator</Text>
          <Text style={styles.subtext}>
            {expanded
              ? 'Tap to collapse'
              : `Active: ${activeOption.icon} ${activeOption.label}`}
          </Text>
        </View>

        <View
          style={[
            styles.statusPill,
            {
              backgroundColor:
                reachable === false
                  ? '#FFEBEE'
                  : currentMode === 'none'
                  ? '#E8F5E9'
                  : '#FFF3E0',
            },
          ]}>
          <Text
            style={[
              styles.statusPillText,
              {
                color:
                  reachable === false
                    ? '#C62828'
                    : currentMode === 'none'
                    ? '#2E7D32'
                    : '#E65100',
              },
            ]}>
            {reachable === false
              ? '● Offline'
              : `${activeOption.icon} ${currentMode.toUpperCase()}`}
          </Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedContent}>
          <Text style={styles.instructions}>
            Test the app's unattended delivery queue by simulating real-world
            failure conditions on demand:
          </Text>

          {loading ? (
            <ActivityIndicator style={styles.loader} color="#2855C5" />
          ) : (
            <View style={styles.optionsGrid}>
              {CHAOS_OPTIONS.map(opt => {
                const isSelected = currentMode === opt.mode;
                return (
                  <TouchableOpacity
                    key={opt.mode}
                    style={[
                      styles.optionButton,
                      isSelected && {
                        borderColor: opt.activeColor,
                        backgroundColor: `${opt.activeColor}15`,
                      },
                    ]}
                    onPress={() => handleSelectMode(opt)}
                    disabled={loading}>
                    <Text style={styles.optionIcon}>{opt.icon}</Text>
                    <Text
                      style={[
                        styles.optionLabel,
                        isSelected && {
                          color: opt.activeColor,
                          fontWeight: '700',
                        },
                      ]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.activeDetailsBox}>
            <Text style={styles.activeDetailsTitle}>
              Current Behavior ({activeOption.label}):
            </Text>
            <Text style={styles.activeDetailsText}>
              {activeOption.description}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 20,
    overflow: 'hidden',
  },
  headerRow: {
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAFC',
  },
  titleContainer: {
    flex: 1,
    marginRight: 10,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  subtext: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  expandedContent: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  instructions: {
    fontSize: 13,
    color: '#475569',
    marginBottom: 12,
    lineHeight: 18,
  },
  loader: {
    marginVertical: 20,
  },
  optionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  optionButton: {
    width: '48%',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  optionIcon: {
    fontSize: 16,
    marginRight: 6,
  },
  optionLabel: {
    fontSize: 12,
    color: '#334155',
    fontWeight: '500',
    flex: 1,
  },
  activeDetailsBox: {
    backgroundColor: '#F1F5F9',
    borderRadius: 8,
    padding: 10,
  },
  activeDetailsTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 2,
  },
  activeDetailsText: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
  },
});

