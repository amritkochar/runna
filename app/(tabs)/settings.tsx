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
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCOUNT</Text>
          <View style={styles.card}>
            <View style={styles.accountHeader}>
              <View style={styles.avatarCircle}>
                <FontAwesome name="user" size={24} color="#FF7F30" />
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountLabel}>Email</Text>
                <Text style={styles.accountValue}>{user?.email}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Connections Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>CONNECTIONS</Text>

          {/* Strava */}
          <TouchableOpacity
            style={styles.connectionCard}
            onPress={handleStravaConnect}
            disabled={!stravaReady}
            activeOpacity={0.7}
          >
            <View style={styles.connectionInfo}>
              <View style={styles.connectionIconStrava}>
                <FontAwesome name="bicycle" size={22} color="#FC4C02" />
              </View>
              <View style={styles.connectionDetails}>
                <Text style={styles.connectionName}>Strava</Text>
                <Text style={styles.connectionStatus}>
                  {stravaConnected ? '✓ Connected' : 'Not connected'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.connectionBadge,
                stravaConnected ? styles.badgeDisconnect : styles.badgeConnect,
              ]}
            >
              <Text
                style={[
                  styles.connectionBadgeText,
                  stravaConnected ? styles.badgeDisconnectText : styles.badgeConnectText,
                ]}
              >
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
              activeOpacity={0.7}
            >
              {syncing ? (
                <ActivityIndicator color="#FF7F30" />
              ) : (
                <>
                  <FontAwesome name="refresh" size={16} color="#FF7F30" />
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
            activeOpacity={0.7}
          >
            <View style={styles.connectionInfo}>
              <View style={styles.connectionIconSpotify}>
                <FontAwesome name="spotify" size={22} color="#1DB954" />
              </View>
              <View style={styles.connectionDetails}>
                <Text style={styles.connectionName}>Spotify</Text>
                <Text style={styles.connectionStatus}>
                  {spotifyConnected
                    ? spotifyIsPremium
                      ? '✓ Premium'
                      : '✓ Free (limited features)'
                    : 'Not connected'}
                </Text>
              </View>
            </View>
            <View
              style={[
                styles.connectionBadge,
                spotifyConnected ? styles.badgeDisconnect : styles.badgeConnect,
              ]}
            >
              <Text
                style={[
                  styles.connectionBadgeText,
                  spotifyConnected ? styles.badgeDisconnectText : styles.badgeConnectText,
                ]}
              >
                {spotifyConnected ? 'Disconnect' : 'Connect'}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Voice Companion Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>VOICE COMPANION</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={() => setVoiceEnabled(!voiceEnabled)}
            activeOpacity={0.7}
          >
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <View style={styles.settingHeader}>
                  <FontAwesome
                    name="microphone"
                    size={18}
                    color={voiceEnabled ? '#34C759' : '#999'}
                    style={styles.settingIcon}
                  />
                  <Text style={styles.settingLabel}>Voice Assistant</Text>
                </View>
                <Text style={styles.settingSubLabel}>
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
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.card}>
            <View style={styles.aboutRow}>
              <FontAwesome name="info-circle" size={18} color="#FF7F30" style={styles.aboutIcon} />
              <Text style={styles.aboutLabel}>Version</Text>
              <Text style={styles.aboutValue}>1.0.0</Text>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <FontAwesome name="sign-out" size={18} color="#FF3B30" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
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
    paddingBottom: 48,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  card: {
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
  accountHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountInfo: {
    flex: 1,
  },
  accountLabel: {
    fontSize: 12,
    fontWeight: '600',
    opacity: 0.5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  accountValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  connectionCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#E5E5E5',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  connectionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  connectionIconStrava: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFF4ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionIconSpotify: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#E8F8EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  connectionDetails: {
    flex: 1,
  },
  connectionName: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 2,
  },
  connectionStatus: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
  },
  connectionBadge: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
  },
  badgeConnect: {
    backgroundColor: '#FFF4ED',
  },
  badgeDisconnect: {
    backgroundColor: '#FFE8E6',
  },
  connectionBadgeText: {
    fontSize: 13,
    fontWeight: '700',
  },
  badgeConnectText: {
    color: '#FF7F30',
  },
  badgeDisconnectText: {
    color: '#FF3B30',
  },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FF7F30',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  syncButtonText: {
    color: '#FF7F30',
    fontWeight: '700',
    fontSize: 15,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  settingIcon: {
    marginRight: 10,
  },
  settingLabel: {
    fontSize: 17,
    fontWeight: '700',
  },
  settingSubLabel: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.6,
    marginTop: 2,
    marginLeft: 28,
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
    backgroundColor: '#E5E5E5',
  },
  toggleKnob: {
    width: 27,
    height: 27,
    borderRadius: 14,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
  },
  knobOn: {
    marginLeft: 'auto',
  },
  knobOff: {
    marginLeft: 0,
  },
  aboutRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  aboutIcon: {
    marginRight: 12,
  },
  aboutLabel: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  aboutValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FF7F30',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 18,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#FF3B30',
    backgroundColor: '#FFFFFF',
    marginTop: 8,
  },
  signOutText: {
    color: '#FF3B30',
    fontSize: 17,
    fontWeight: '700',
  },
});
