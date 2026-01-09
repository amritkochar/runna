import { StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { Text, View } from '@/components/Themed';
import { useRunStore } from '@/stores/runStore';
import { useStrava } from '@/hooks/useStrava';
import { useSpotify } from '@/hooks/useSpotify';
import { Link, useRouter } from 'expo-router';

export default function HomeScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

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

  // Recent runs summary - only show last 3
  const recentRuns = activities.slice(0, 3);
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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Quick Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>THIS WEEK</Text>
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
          <Text style={styles.sectionTitle}>CONNECTIONS</Text>
          <View style={styles.connections}>
            <View style={styles.connectionItem}>
              <Text style={styles.connectionName}>Strava</Text>
              <View
                style={[
                  styles.connectionStatus,
                  stravaConnected ? styles.connected : styles.disconnected,
                ]}
              >
                <Text style={[styles.connectionStatusText, stravaConnected && styles.connectedText]}>
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
                <Text style={[styles.connectionStatusText, spotifyConnected && styles.connectedText]}>
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
            <Text style={styles.sectionTitle}>NOW PLAYING</Text>
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
                <Text style={[styles.playStatusText, isPlaying && styles.playingText]}>
                  {isPlaying ? '▶ Playing' : '⏸ Paused'}
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Runner Persona */}
        {runnerPersona && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR RUNNING PROFILE</Text>
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

        {/* Recent Runs - Only 3 */}
        {recentRuns.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>RECENT RUNS</Text>
              {activities.length > 3 && (
                <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                  <Text style={styles.seeAllText}>See all</Text>
                </TouchableOpacity>
              )}
            </View>
            {recentRuns.map((run) => (
              <View key={run.id} style={styles.runItem}>
                <View style={styles.runHeader}>
                  <Text style={styles.runName}>{run.name}</Text>
                  <Text style={styles.runDate}>
                    {new Date(run.start_date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                </View>
                <View style={styles.runStats}>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatValue}>
                      {(run.distance_meters / 1000).toFixed(2)}
                    </Text>
                    <Text style={styles.runStatLabel}>km</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatValue}>
                      {(run.moving_time_seconds / 60 / (run.distance_meters / 1000)).toFixed(1)}
                    </Text>
                    <Text style={styles.runStatLabel}>min/km</Text>
                  </View>
                  <View style={styles.runStat}>
                    <Text style={styles.runStatValue}>
                      {Math.floor(run.moving_time_seconds / 60)}m {run.moving_time_seconds % 60}s
                    </Text>
                    <Text style={styles.runStatLabel}>duration</Text>
                  </View>
                  {run.average_heartrate && (
                    <View style={styles.runStat}>
                      <Text style={styles.runStatValue}>
                        {Math.round(run.average_heartrate)}
                      </Text>
                      <Text style={styles.runStatLabel}>avg bpm</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Start Run CTA */}
        <Link href="/(tabs)/run" asChild>
          <TouchableOpacity style={styles.startRunButton} activeOpacity={0.8}>
            <Text style={styles.startRunButtonText}>Start a Run</Text>
          </TouchableOpacity>
        </Link>
      </ScrollView>
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
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  seeAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FF7F30',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    padding: 20,
    borderRadius: 16,
    backgroundColor: '#FF7F30',
    alignItems: 'center',
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
    opacity: 0.9,
    marginTop: 4,
  },
  connections: {
    gap: 10,
  },
  connectionItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionStatus: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
  },
  connected: {
    backgroundColor: '#E8F8EE',
  },
  disconnected: {
    backgroundColor: '#FFE8E6',
  },
  connectionStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  connectedText: {
    color: '#34C759',
  },
  connectButton: {
    marginTop: 12,
    padding: 14,
    backgroundColor: '#FF7F30',
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  connectButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  nowPlaying: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
  },
  trackInfo: {
    flex: 1,
    marginRight: 12,
  },
  trackName: {
    fontSize: 16,
    fontWeight: '600',
  },
  trackArtist: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  playStatus: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  playing: {
    backgroundColor: '#E8F8EE',
  },
  playStatusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
  },
  playingText: {
    color: '#34C759',
  },
  personaCard: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  personaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  personaLabel: {
    fontSize: 15,
    opacity: 0.6,
  },
  personaValue: {
    fontSize: 15,
    fontWeight: '700',
  },
  runItem: {
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  runName: {
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  runDate: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.5,
  },
  runStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  runStat: {
    minWidth: 70,
  },
  runStatValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FF7F30',
  },
  runStatLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
    marginTop: 2,
    textTransform: 'uppercase',
  },
  startRunButton: {
    backgroundColor: '#FF7F30',
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 5,
  },
  startRunButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
