import { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRunStore } from '@/stores/runStore';
import { useSpotify } from '@/hooks/useSpotify';
import { useVoiceCompanion } from '@/hooks/useVoiceCompanion';
import { useGPSTracking } from '@/hooks/useGPSTracking';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function RunScreen() {
  const {
    isRunning,
    runStartTime,
    runDuration,
    voiceEnabled,
    isListening,
    isSpeaking,
    gpsMetrics,
    locationPermission,
    gpsError,
    startRun,
    endRun,
    updateRunStats,
    setVoiceEnabled,
    setListening,
  } = useRunStore();

  const {
    spotifyConnected,
    spotifyIsPremium,
    currentTrack,
    isPlaying,
    togglePlayback,
    nextTrack,
    previousTrack,
  } = useSpotify();

  const [duration, setDuration] = useState(0);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Initialize GPS tracking
  useGPSTracking();

  // Debug: Log GPS metrics updates
  useEffect(() => {
    console.log('📊 [UI] GPS Metrics updated:', {
      distance: (gpsMetrics.totalDistance / 1000).toFixed(3) + ' km',
      currentSpeed: gpsMetrics.currentSpeed.toFixed(1) + ' km/h',
      currentPace: gpsMetrics.currentPace.toFixed(2) + ' min/km',
      avgSpeed: gpsMetrics.averageSpeed.toFixed(1) + ' km/h',
      avgPace: gpsMetrics.averagePace.toFixed(2) + ' min/km',
      hasLocation: !!gpsMetrics.currentLocation,
    });
  }, [gpsMetrics]);

  // Timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isRunning && runStartTime) {
      interval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - runStartTime.getTime()) / 1000);
        setDuration(elapsed);
        updateRunStats(0, elapsed); // Update store
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, runStartTime, updateRunStats]);

  // Pulse animation when listening
  useEffect(() => {
    if (isListening) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.2,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isListening, pulseAnim]);

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDistance = (meters: number) => {
    const km = meters / 1000;
    return km.toFixed(2);
  };

  const formatPace = (minPerKm: number) => {
    if (minPerKm === 0 || !isFinite(minPerKm)) return '--:--';
    const mins = Math.floor(minPerKm);
    const secs = Math.floor((minPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatSpeed = (kmh: number) => {
    return kmh.toFixed(1);
  };

  const handleStartStop = () => {
    console.log('🏃 [UI] Start/Stop button pressed - Current state:', isRunning);
    if (isRunning) {
      console.log('⏹️ [UI] Ending run...');
      endRun();
      setDuration(0);
    } else {
      console.log('▶️ [UI] Starting run...');
      startRun();
    }
  };

  // Voice companion
  const { toggleListening } = useVoiceCompanion();

  const handleVoicePress = () => {
    if (voiceEnabled) {
      toggleListening();
    }
  };

  return (
    <View style={styles.container}>
      {/* Timer Display */}
      <View style={styles.timerSection}>
        <Text style={styles.timerLabel}>
          {isRunning ? 'Running' : 'Ready to run'}
        </Text>
        <Text style={styles.timer}>{formatTime(duration)}</Text>
      </View>

      {/* GPS Metrics */}
      {isRunning && (
        <View style={styles.metricsSection}>
          {/* Distance */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>
              {formatDistance(gpsMetrics.totalDistance)}
            </Text>
            <Text style={styles.metricUnit}>km</Text>
          </View>

          {/* Current Pace */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Pace</Text>
            <Text style={styles.metricValue}>
              {formatPace(gpsMetrics.currentPace)}
            </Text>
            <Text style={styles.metricUnit}>min/km</Text>
          </View>

          {/* Speed */}
          <View style={styles.metricCard}>
            <Text style={styles.metricLabel}>Speed</Text>
            <Text style={styles.metricValue}>
              {formatSpeed(gpsMetrics.currentSpeed)}
            </Text>
            <Text style={styles.metricUnit}>km/h</Text>
          </View>
        </View>
      )}

      {/* GPS Error Alert */}
      {gpsError && (
        <View style={styles.errorSection}>
          <FontAwesome name="exclamation-triangle" size={16} color="#FF9500" />
          <Text style={styles.errorText}>{gpsError}</Text>
        </View>
      )}

      {/* Voice Companion Status */}
      {voiceEnabled && isRunning && (
        <View style={styles.voiceSection}>
          <Animated.View
            style={[
              styles.voiceIndicator,
              isListening && styles.voiceActive,
              { transform: [{ scale: pulseAnim }] },
            ]}
          >
            <FontAwesome
              name={isListening ? 'microphone' : isSpeaking ? 'volume-up' : 'microphone-slash'}
              size={24}
              color={isListening ? '#34C759' : isSpeaking ? '#007AFF' : '#666'}
            />
          </Animated.View>
          <Text style={styles.voiceStatus}>
            {isListening
              ? 'Listening...'
              : isSpeaking
              ? 'Speaking...'
              : 'Tap mic to talk'}
          </Text>
          <TouchableOpacity
            style={styles.voiceButton}
            onPress={handleVoicePress}
          >
            <Text style={styles.voiceButtonText}>
              {isListening ? 'Stop' : 'Talk to Runna'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Spotify Mini Player */}
      {spotifyConnected && currentTrack && (
        <View style={styles.playerSection}>
          <View style={styles.trackInfo}>
            <Text style={styles.trackName} numberOfLines={1}>
              {currentTrack.name}
            </Text>
            <Text style={styles.trackArtist} numberOfLines={1}>
              {currentTrack.artists.map((a) => a.name).join(', ')}
            </Text>
          </View>
          {spotifyIsPremium && (
            <View style={styles.playerControls}>
              <TouchableOpacity onPress={previousTrack} style={styles.controlButton}>
                <FontAwesome name="step-backward" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                <FontAwesome
                  name={isPlaying ? 'pause' : 'play'}
                  size={24}
                  color="#fff"
                />
              </TouchableOpacity>
              <TouchableOpacity onPress={nextTrack} style={styles.controlButton}>
                <FontAwesome name="step-forward" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}

      {/* Start/Stop Button */}
      <View style={styles.controlSection}>
        <TouchableOpacity
          style={[styles.mainButton, isRunning && styles.stopButton]}
          onPress={handleStartStop}
        >
          <Text style={styles.mainButtonText}>
            {isRunning ? 'End Run' : 'Start Run'}
          </Text>
        </TouchableOpacity>

        {/* Voice Toggle */}
        <TouchableOpacity
          style={[styles.toggleButton, !voiceEnabled && styles.toggleDisabled]}
          onPress={() => setVoiceEnabled(!voiceEnabled)}
        >
          <FontAwesome
            name="microphone"
            size={20}
            color={voiceEnabled ? '#34C759' : '#666'}
          />
          <Text style={[styles.toggleText, !voiceEnabled && styles.toggleTextDisabled]}>
            Voice {voiceEnabled ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Instructions */}
      {!isRunning && (
        <View style={styles.instructions}>
          <Text style={styles.instructionTitle}>During your run:</Text>
          <Text style={styles.instruction}>📍 GPS tracks your distance, pace, and speed</Text>
          <Text style={styles.instruction}>🎤 Ask for jokes, news, or motivation</Text>
          <Text style={styles.instruction}>🎵 Control your music with your voice</Text>
          <Text style={styles.instruction}>📝 Save notes and reminders</Text>
          <Text style={styles.instruction}>📊 Ask about your running stats</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
  },
  timerSection: {
    alignItems: 'center',
    marginTop: 40,
  },
  timerLabel: {
    fontSize: 16,
    opacity: 0.6,
    marginBottom: 8,
  },
  timer: {
    fontSize: 72,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
  },
  voiceSection: {
    alignItems: 'center',
    marginTop: 40,
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  voiceIndicator: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceActive: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  voiceStatus: {
    fontSize: 15,
    marginTop: 12,
    opacity: 0.7,
  },
  voiceButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  voiceButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  playerSection: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  trackInfo: {
    marginBottom: 12,
  },
  trackName: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackArtist: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  playerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
  },
  controlButton: {
    padding: 12,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlSection: {
    marginTop: 'auto',
    gap: 16,
  },
  mainButton: {
    backgroundColor: '#34C759',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
  },
  stopButton: {
    backgroundColor: '#FF3B30',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#34C759',
  },
  toggleDisabled: {
    borderColor: '#666',
  },
  toggleText: {
    color: '#34C759',
    fontWeight: '600',
  },
  toggleTextDisabled: {
    color: '#666',
  },
  instructions: {
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  instructionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    opacity: 0.8,
  },
  instruction: {
    fontSize: 14,
    opacity: 0.6,
    marginBottom: 6,
  },
  metricsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 32,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  metricUnit: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  errorSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderWidth: 1,
    borderColor: '#FF9500',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: '#FF9500',
  },
});
