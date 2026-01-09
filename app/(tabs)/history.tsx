import { StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { useState, useCallback, useEffect } from 'react';
import { Text, View } from '@/components/Themed';
import { useRunStore } from '@/stores/runStore';
import { useStrava } from '@/hooks/useStrava';

export default function HistoryScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const { activities, stravaConnected } = useRunStore();
  const { syncActivities } = useStrava();

  // Debug: Log when component mounts and when activities change
  useEffect(() => {
    console.log('📊 [History] Screen mounted');
    console.log('📊 [History] Strava connected:', stravaConnected);
    console.log('📊 [History] Activities count:', activities.length);
    if (activities.length > 0) {
      console.log('📊 [History] First activity:', activities[0].name);
      console.log('📊 [History] Latest activity date:', activities[0].start_date);
    }
  }, [activities, stravaConnected]);

  const onRefresh = useCallback(async () => {
    if (!stravaConnected) {
      console.log('⚠️ [History] Cannot sync - Strava not connected');
      return;
    }

    console.log('🔄 [History] User initiated sync via pull-to-refresh');
    setRefreshing(true);
    try {
      const newCount = await syncActivities();
      console.log(`✅ [History] Sync complete - ${newCount} new activities synced`);
    } catch (error) {
      console.error('❌ [History] Error syncing:', error);
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
        {item.average_heartrate && item.average_heartrate > 0 && (
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
          <View style={styles.elevationBadge}>
            <Text style={styles.elevationText}>
              ⬆ {Math.round(item.elevation_gain)}m
            </Text>
          </View>
          {item.calories && item.calories > 0 && (
            <View style={styles.caloriesBadge}>
              <Text style={styles.caloriesText}>
                🔥 {Math.round(item.calories)} cal
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  if (!stravaConnected) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyIcon}>🏃</Text>
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
        <Text style={styles.emptyIcon}>📊</Text>
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
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#FF7F30"
        />
      }
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      showsVerticalScrollIndicator={false}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    padding: 20,
    paddingBottom: 40,
  },
  activityCard: {
    padding: 20,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 18,
  },
  activityName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  activityDate: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.5,
    textTransform: 'uppercase',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  statItem: {
    minWidth: 70,
  },
  statValue: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FF7F30',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '600',
    opacity: 0.5,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  extraStats: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  elevationBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFF4ED',
  },
  elevationText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7F30',
  },
  caloriesBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#FFF4ED',
  },
  caloriesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF7F30',
  },
  separator: {
    height: 16,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    opacity: 0.6,
    textAlign: 'center',
    lineHeight: 22,
  },
  syncButton: {
    marginTop: 24,
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#FF7F30',
    borderRadius: 24,
    shadowColor: '#FF7F30',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  syncButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
