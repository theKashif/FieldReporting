import React, { memo } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

interface StartOverSectionProps {
  onReset: () => void;
  resetting: boolean;
  disabled: boolean;
}

function StartOverSectionComponent({
  onReset,
  resetting,
  disabled,
}: StartOverSectionProps) {
  return (
    <View style={styles.resetSection}>
      <Text style={styles.resetHeading}>Start Over</Text>
      <Text style={styles.resetDescription}>
        A deliberate reset to test the delivery pipeline or discard pending state.
      </Text>
      <TouchableOpacity
        style={[styles.resetButton, disabled && styles.disabledButton]}
        onPress={onReset}
        disabled={disabled}>
        {resetting ? (
          <ActivityIndicator color="#D22F3F" />
        ) : (
          <Text style={styles.resetButtonText}>
            Start Over / Reset Pipeline
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

export const StartOverSection = memo(StartOverSectionComponent);
export default StartOverSection;

const styles = StyleSheet.create({
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
  disabledButton: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: '#E53E3E',
    fontWeight: '700',
    fontSize: 14,
  },
});

