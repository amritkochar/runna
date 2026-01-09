import { useState, useEffect, useRef } from 'react';
import { StyleSheet, TouchableOpacity, Animated, ScrollView } from 'react-native';
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Timer Display */}
        <View style={styles.timerSection}>
          <View style={styles.statusBadge}>
            <View style={[styles.statusDot, isRunning && styles.statusDotActive]} />
            <Text style={styles.timerLabel}>
              {isRunning ? 'Running' : 'Ready to run'}
            </Text>
          </View>
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
                size={32}
                color={isListening ? '#34C759' : isSpeaking ? '#FF7F30' : '#999'}
              />
            </Animated.View>
            <Text style={styles.voiceStatus}>
              {isListening
                ? '🎤 Listening...'
                : isSpeaking
                ? '🔊 Speaking...'
                : 'Tap to talk'}
            </Text>
            <TouchableOpacity
              style={[styles.voiceButton, isListening && styles.voiceButtonActive]}
              onPress={handleVoicePress}
              activeOpacity={0.8}
            >
              <Text style={styles.voiceButtonText}>
                {isListening ? 'Stop Listening' : 'Talk to Runna'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Spotify Mini Player */}
        {spotifyConnected && currentTrack && (
          <View style={styles.playerSection}>
            <Text style={styles.playerTitle}>NOW PLAYING</Text>
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
                  <FontAwesome name="step-backward" size={24} color="#666" />
                </TouchableOpacity>
                <TouchableOpacity onPress={togglePlayback} style={styles.playButton}>
                  <FontAwesome
                    name={isPlaying ? 'pause' : 'play'}
                    size={28}
                    color="#fff"
                  />
                </TouchableOpacity>
                <TouchableOpacity onPress={nextTrack} style={styles.controlButton}>
                  <FontAwesome name="step-forward" size={24} color="#666" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Instructions */}
        {!isRunning && (
          <View style={styles.instructions}>
            <Text style={styles.instructionTitle}>✨ During your run, you can:</Text>
            <View style={styles.instructionList}>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionBullet}>📍</Text>
                <Text style={styles.instruction}>GPS tracks your distance, pace, and speed</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionBullet}>💬</Text>
                <Text style={styles.instruction}>Ask for jokes, news, or motivation</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionBullet}>🎵</Text>
                <Text style={styles.instruction}>Control your music with your voice</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionBullet}>📝</Text>
                <Text style={styles.instruction}>Save notes and reminders</Text>
              </View>
              <View style={styles.instructionItem}>
                <Text style={styles.instructionBullet}>📊</Text>
                <Text style={styles.instruction}>Ask about your running stats</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Fixed Bottom Controls */}
      <View style={styles.controlSection}>
        {/* Voice Toggle */}
        <TouchableOpacity
          style={[styles.toggleButton, voiceEnabled && styles.toggleButtonActive]}
          onPress={() => setVoiceEnabled(!voiceEnabled)}
          activeOpacity={0.8}
        >
          <FontAwesome
            name="microphone"
            size={18}
            color={voiceEnabled ? '#34C759' : '#999'}
          />
          <Text style={[styles.toggleText, voiceEnabled && styles.toggleTextActive]}>
            Voice Companion {voiceEnabled ? 'On' : 'Off'}
          </Text>
        </TouchableOpacity>

        {/* Start/Stop Button */}
        <TouchableOpacity
          style={[styles.mainButton, isRunning && styles.stopButton]}
          onPress={handleStartStop}
          activeOpacity={0.85}
        >
          <Text style={styles.mainButtonText}>
            {isRunning ? '⏹ End Run' : '▶ Start Run'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 24,
    paddingBottom: 180,
  },
  timerSection: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 40,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    marginBottom: 16,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#999',
  },
  statusDotActive: {
    backgroundColor: '#34C759',
  },
  timerLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
    opacity: 0.7,
  },
  timer: {
    fontSize: 80,
    fontWeight: '200',
    fontVariant: ['tabular-nums'],
    color: '#FF7F30',
  },
  metricsSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 32,
  },
  metricCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    color: '#FF7F30',
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
    marginBottom: 24,
    padding: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderWidth: 1.5,
    borderColor: '#FF9500',
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#FF9500',
  },
  voiceSection: {
    alignItems: 'center',
    marginBottom: 32,
    padding: 28,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  voiceIndicator: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F5F5F5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  voiceActive: {
    backgroundColor: '#E8F8EE',
    borderWidth: 3,
    borderColor: '#34C759',
  },
  voiceStatus: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 20,
  },
  voiceButton: {
    paddingHorizontal: 28,
    paddingVertical: 14,
    backgroundColor: '#FF7F30',
    borderRadius: 24,
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  voiceButtonActive: {
    backgroundColor: '#FF3B30',
  },
  voiceButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  playerSection: {
    marginBottom: 32,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  playerTitle: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  trackInfo: {
    marginBottom: 20,
  },
  trackName: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 4,
  },
  trackArtist: {
    fontSize: 14,
    opacity: 0.6,
  },
  playerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  controlButton: {
    padding: 12,
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#FF7F30',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  controlSection: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 20,
    paddingBottom: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.98)',
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
    gap: 12,
  },
  mainButton: {
    backgroundColor: '#FF7F30',
    padding: 20,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  stopButton: {
    backgroundColor: '#FF3B30',
    shadowColor: '#FF3B30',
  },
  mainButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  toggleButtonActive: {
    borderColor: '#34C759',
    backgroundColor: '#E8F8EE',
  },
  toggleText: {
    color: '#999',
    fontWeight: '600',
    fontSize: 15,
  },
  toggleTextActive: {
    color: '#34C759',
  },
  instructions: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  instructionTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 16,
  },
  instructionList: {
    gap: 12,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  instructionBullet: {
    fontSize: 20,
    width: 28,
  },
  instruction: {
    fontSize: 15,
    lineHeight: 22,
    flex: 1,
    opacity: 0.7,
  },
});
