import { StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback } from 'react';
import { Text, View } from '@/components/Themed';
import { useRunStore } from '@/stores/runStore';
import { useStrava } from '@/hooks/useStrava';

export default function HistoryScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { activities, stravaConnected } = useRunStore();
  const { syncActivities } = useStrava();

  const onRefresh = useCallback(async () => {
    if (!stravaConnected) return;

    setRefreshing(true);
    try {
      await syncActivities();
    } catch (error) {
      console.error('Error syncing:', error);
    }
    setRefreshing(false);
  }, [stravaConnected, syncActivities]);

  const formatPace = (seconds: number, meters: number) => {
    const paceMinPerKm = (seconds / 60) / (meters / 1000);
    const mins = Math.floor(paceMinPerKm);
    const secs = Math.round((paceMinPerKm - mins) * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hrs > 0) {
      return `${hrs}h ${mins}m`;
    }
    return `${mins}m ${secs}s`;
  };

  const renderActivity = ({ item }: { item: typeof activities[0] }) => (
    <View style={styles.activityCard}>
      <View style={styles.activityHeader}>
        <Text style={styles.activityName}>{item.name}</Text>
        <Text style={styles.activityDate}>
          {new Date(item.start_date).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {(item.distance_meters / 1000).toFixed(2)}
          </Text>
          <Text style={styles.statLabel}>km</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatPace(item.moving_time_seconds, item.distance_meters)}
          </Text>
          <Text style={styles.statLabel}>min/km</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatDuration(item.moving_time_seconds)}
          </Text>
          <Text style={styles.statLabel}>duration</Text>
        </View>
        {item.average_heartrate && (
          <View style={styles.statItem}>
            <Text style={styles.statValue}>
              {Math.round(item.average_heartrate)}
            </Text>
            <Text style={styles.statLabel}>avg bpm</Text>
          </View>
        )}
      </View>

      {item.elevation_gain && item.elevation_gain > 0 && (
        <View style={styles.extraStats}>
          <Text style={styles.extraStat}>
            Elevation: +{Math.round(item.elevation_gain)}m
          </Text>
          {item.calories && (
            <Text style={styles.extraStat}>
              Calories: {Math.round(item.calories)}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (!stravaConnected) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>Connect Strava</Text>
        <Text style={styles.emptyText}>
          Connect your Strava account in Settings to see your run history.
        </Text>
      </View>
    );
  }

  if (activities.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyTitle}>No runs yet</Text>
        <Text style={styles.emptyText}>
          Your Strava runs will appear here once synced.
        </Text>
        <TouchableOpacity style={styles.syncButton} onPress={onRefresh}>
          <Text style={styles.syncButtonText}>Sync Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <FlatList
      data={activities}
      renderItem={renderActivity}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 16,
  },
  activityCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  activityName: {
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  activityDate: {
    fontSize: 13,
    opacity: 0.6,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  statItem: {
    minWidth: 70,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 2,
  },
  extraStats: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  extraStat: {
    fontSize: 13,
    opacity: 0.6,
  },
  separator: {
    height: 12,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
  },
  syncButton: {
    marginTop: 24,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 20,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
