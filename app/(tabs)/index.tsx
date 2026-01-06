import { StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { Text, View } from '@/components/Themed';
import { useRunStore } from '@/stores/runStore';
import { useStrava } from '@/hooks/useStrava';
import { useSpotify } from '@/hooks/useSpotify';
import { Link } from 'expo-router';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);

  const {
    stravaConnected,
    spotifyConnected,
    runnerPersona,
    activities,
  } = useRunStore();

  const { syncActivities } = useStrava();
  const { currentTrack, isPlaying } = useSpotify();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      if (stravaConnected) {
        await syncActivities();
      }
    } catch (error) {
      console.error('Error refreshing:', error);
    }
    setRefreshing(false);
  }, [stravaConnected, syncActivities]);

  // Recent runs summary
  const recentRuns = activities.slice(0, 5);
  const thisWeekRuns = activities.filter((a) => {
    const runDate = new Date(a.start_date);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return runDate > weekAgo;
  });

  const weeklyDistance = thisWeekRuns.reduce(
    (sum, a) => sum + a.distance_meters / 1000,
    0
  );
  const weeklyTime = thisWeekRuns.reduce(
    (sum, a) => sum + a.moving_time_seconds / 60,
    0
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      {/* Quick Stats */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>This Week</Text>
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{thisWeekRuns.length}</Text>
            <Text style={styles.statLabel}>Runs</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{weeklyDistance.toFixed(1)}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{Math.round(weeklyTime)}</Text>
            <Text style={styles.statLabel}>min</Text>
          </View>
        </View>
      </View>

      {/* Connection Status */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connections</Text>
        <View style={styles.connections}>
          <View style={styles.connectionItem}>
            <Text style={styles.connectionName}>Strava</Text>
            <View
              style={[
                styles.connectionStatus,
                stravaConnected ? styles.connected : styles.disconnected,
              ]}
            >
              <Text style={styles.connectionStatusText}>
                {stravaConnected ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
          <View style={styles.connectionItem}>
            <Text style={styles.connectionName}>Spotify</Text>
            <View
              style={[
                styles.connectionStatus,
                spotifyConnected ? styles.connected : styles.disconnected,
              ]}
            >
              <Text style={styles.connectionStatusText}>
                {spotifyConnected ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
        </View>
        {(!stravaConnected || !spotifyConnected) && (
          <Link href="/(tabs)/settings" asChild>
            <TouchableOpacity style={styles.connectButton}>
              <Text style={styles.connectButtonText}>Connect Services</Text>
            </TouchableOpacity>
          </Link>
        )}
      </View>

      {/* Now Playing */}
      {spotifyConnected && currentTrack && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Now Playing</Text>
          <View style={styles.nowPlaying}>
            <View style={styles.trackInfo}>
              <Text style={styles.trackName} numberOfLines={1}>
                {currentTrack.name}
              </Text>
              <Text style={styles.trackArtist} numberOfLines={1}>
                {currentTrack.artists.map((a) => a.name).join(', ')}
              </Text>
            </View>
            <View style={[styles.playStatus, isPlaying && styles.playing]}>
              <Text style={styles.playStatusText}>
                {isPlaying ? 'Playing' : 'Paused'}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Runner Persona */}
      {runnerPersona && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Running Profile</Text>
          <View style={styles.personaCard}>
            <View style={styles.personaRow}>
              <Text style={styles.personaLabel}>Typical Distance</Text>
              <Text style={styles.personaValue}>
                {runnerPersona.typical_distance_km} km
              </Text>
            </View>
            <View style={styles.personaRow}>
              <Text style={styles.personaLabel}>Average Pace</Text>
              <Text style={styles.personaValue}>
                {runnerPersona.average_pace_min_per_km} min/km
              </Text>
            </View>
            <View style={styles.personaRow}>
              <Text style={styles.personaLabel}>Preferred Time</Text>
              <Text style={styles.personaValue}>
                {runnerPersona.preferred_run_time}
              </Text>
            </View>
            <View style={styles.personaRow}>
              <Text style={styles.personaLabel}>Weekly Runs</Text>
              <Text style={styles.personaValue}>
                {runnerPersona.running_frequency.toFixed(1)}x
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Runs</Text>
          {recentRuns.map((run) => (
            <View key={run.id} style={styles.runItem}>
              <View style={styles.runInfo}>
                <Text style={styles.runName}>{run.name}</Text>
                <Text style={styles.runDate}>
                  {new Date(run.start_date).toLocaleDateString()}
                </Text>
              </View>
              <View style={styles.runStats}>
                <Text style={styles.runDistance}>
                  {(run.distance_meters / 1000).toFixed(2)} km
                </Text>
                <Text style={styles.runPace}>
                  {(run.moving_time_seconds / 60 / (run.distance_meters / 1000)).toFixed(1)}{' '}
                  min/km
                </Text>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* Start Run CTA */}
      <Link href="/(tabs)/run" asChild>
        <TouchableOpacity style={styles.startRunButton}>
          <Text style={styles.startRunButtonText}>Start a Run</Text>
        </TouchableOpacity>
      </Link>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 4,
  },
  connections: {
    gap: 8,
  },
  connectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '500',
  },
  connectionStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  connected: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  disconnected: {
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
  },
  connectionStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  connectButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  nowPlaying: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackName: {
    fontSize: 16,
    fontWeight: '500',
  },
  trackArtist: {
    fontSize: 14,
    opacity: 0.6,
    marginTop: 2,
  },
  playStatus: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  playing: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  playStatusText: {
    fontSize: 13,
    fontWeight: '500',
  },
  personaCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    gap: 12,
  },
  personaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  personaLabel: {
    opacity: 0.6,
  },
  personaValue: {
    fontWeight: '600',
  },
  runItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  runInfo: {
    flex: 1,
  },
  runName: {
    fontSize: 15,
    fontWeight: '500',
  },
  runDate: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  runStats: {
    alignItems: 'flex-end',
  },
  runDistance: {
    fontSize: 15,
    fontWeight: '600',
  },
  runPace: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  startRunButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  startRunButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
});
