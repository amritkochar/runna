import { useState } from 'react';
import {
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Text, View } from '@/components/Themed';
import { useAuth } from '@/hooks/useAuth';
import { useStrava } from '@/hooks/useStrava';
import { useSpotify } from '@/hooks/useSpotify';
import { useRunStore } from '@/stores/runStore';
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function SettingsScreen() {
  const [syncing, setSyncing] = useState(false);

  const { user, signOut } = useAuth();
  const {
    stravaConnected,
    connectStrava,
    disconnectStrava,
    syncActivities,
    isAuthReady: stravaReady,
  } = useStrava();
  const { spotifyConnected, connectSpotify, disconnectSpotify } = useSpotify();
  const { voiceEnabled, setVoiceEnabled, spotifyIsPremium, activities } = useRunStore();

  const handleStravaConnect = async () => {
    if (stravaConnected) {
      Alert.alert('Disconnect Strava', 'Are you sure you want to disconnect?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: disconnectStrava,
        },
      ]);
    } else {
      await connectStrava();
    }
  };

  const handleSpotifyConnect = async () => {
    if (spotifyConnected) {
      Alert.alert('Disconnect Spotify', 'Are you sure you want to disconnect?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: disconnectSpotify,
        },
      ]);
    } else {
      try {
        setSyncing(true);
        const result = await connectSpotify();

        if (result.isPremium) {
          Alert.alert(
            'Connected!',
            'Spotify Premium connected. You can now control playback during runs.',
            [{ text: 'OK' }]
          );
        } else {
          Alert.alert(
            'Connected',
            'Spotify Free account connected. You can see what\'s playing, but playback control requires Spotify Premium.',
            [{ text: 'OK' }]
          );
        }
      } catch (error: any) {
        Alert.alert(
          'Connection Failed',
          error.message || 'Could not connect to Spotify. Please try again.',
          [{ text: 'OK' }]
        );
      } finally {
        setSyncing(false);
      }
    }
  };

  const handleSync = async () => {
    if (!stravaConnected) return;

    setSyncing(true);
    try {
      const count = await syncActivities();
      Alert.alert('Sync Complete', `Synced ${count || 0} new activities`);
    } catch (error: any) {
      Alert.alert('Sync Failed', error.message || 'Could not sync activities');
    }
    setSyncing(false);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: signOut,
      },
    ]);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Account Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>{user?.email}</Text>
          </View>
        </View>
      </View>

      {/* Connections Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connections</Text>

        {/* Strava */}
        <TouchableOpacity
          style={styles.connectionCard}
          onPress={handleStravaConnect}
          disabled={!stravaReady}
        >
          <View style={styles.connectionInfo}>
            <View style={styles.connectionIcon}>
              <FontAwesome name="bicycle" size={20} color="#FC4C02" />
            </View>
            <View>
              <Text style={styles.connectionName}>Strava</Text>
              <Text style={styles.connectionStatus}>
                {stravaConnected ? 'Connected' : 'Not connected'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.connectionBadge,
              stravaConnected ? styles.connected : styles.disconnected,
            ]}
          >
            <Text style={styles.connectionBadgeText}>
              {stravaConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Sync Button */}
        {stravaConnected && (
          <TouchableOpacity
            style={styles.syncButton}
            onPress={handleSync}
            disabled={syncing}
          >
            {syncing ? (
              <ActivityIndicator color="#007AFF" />
            ) : (
              <>
                <FontAwesome name="refresh" size={16} color="#007AFF" />
                <Text style={styles.syncButtonText}>
                  Sync Activities ({activities.length} synced)
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}

        {/* Spotify */}
        <TouchableOpacity
          style={styles.connectionCard}
          onPress={handleSpotifyConnect}
        >
          <View style={styles.connectionInfo}>
            <View style={[styles.connectionIcon, { backgroundColor: '#1DB954' }]}>
              <FontAwesome name="spotify" size={20} color="#fff" />
            </View>
            <View>
              <Text style={styles.connectionName}>Spotify</Text>
              <Text style={styles.connectionStatus}>
                {spotifyConnected
                  ? spotifyIsPremium
                    ? 'Premium'
                    : 'Free (limited features)'
                  : 'Not connected'}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.connectionBadge,
              spotifyConnected ? styles.connected : styles.disconnected,
            ]}
          >
            <Text style={styles.connectionBadgeText}>
              {spotifyConnected ? 'Disconnect' : 'Connect'}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Voice Companion Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Voice Companion</Text>
        <TouchableOpacity
          style={styles.card}
          onPress={() => setVoiceEnabled(!voiceEnabled)}
        >
          <View style={styles.row}>
            <View style={styles.settingInfo}>
              <Text style={styles.label}>Voice Assistant</Text>
              <Text style={styles.sublabel}>
                Talk to Runna during your runs
              </Text>
            </View>
            <View
              style={[
                styles.toggle,
                voiceEnabled ? styles.toggleOn : styles.toggleOff,
              ]}
            >
              <View
                style={[
                  styles.toggleKnob,
                  voiceEnabled ? styles.knobOn : styles.knobOff,
                ]}
              />
            </View>
          </View>
        </TouchableOpacity>
      </View>

      {/* About Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* Sign Out */}
      <TouchableOpacity style={styles.signOutButton} onPress={handleSignOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 48,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    opacity: 0.6,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 12,
    marginLeft: 4,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
  },
  sublabel: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  value: {
    fontSize: 16,
    opacity: 0.6,
  },
  settingInfo: {
    flex: 1,
  },
  connectionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 8,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(252, 76, 2, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionName: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionStatus: {
    fontSize: 13,
    opacity: 0.6,
    marginTop: 2,
  },
  connectionBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  connected: {
    backgroundColor: 'rgba(255, 69, 58, 0.2)',
  },
  disconnected: {
    backgroundColor: 'rgba(0, 122, 255, 0.2)',
  },
  connectionBadgeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    marginBottom: 8,
  },
  syncButtonText: {
    color: '#007AFF',
    fontWeight: '500',
  },
  toggle: {
    width: 51,
    height: 31,
    borderRadius: 16,
    padding: 2,
  },
  toggleOn: {
    backgroundColor: '#34C759',
  },
  toggleOff: {
    backgroundColor: '#333',
  },
  toggleKnob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#fff',
  },
  knobOn: {
    marginLeft: 'auto',
  },
  knobOff: {
    marginLeft: 0,
  },
  signOutButton: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FF3B30',
    alignItems: 'center',
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 16,
    fontWeight: '600',
  },
});
