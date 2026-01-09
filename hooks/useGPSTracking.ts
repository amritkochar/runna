import { useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import { LocationSubscription } from 'expo-location';
import { Alert, Platform, Linking } from 'react-native';
import { useRunStore } from '@/stores/runStore';
import type { LocationPoint, GPSMetrics, LocationErrorType } from '@/types';

/**
 * Production-ready GPS tracking hook for iOS
 * Handles permissions, location watching, and real-time metrics calculation
 */
export function useGPSTracking() {
  const subscriptionRef = useRef<LocationSubscription | null>(null);
  const isTrackingRef = useRef(false);
  const lastPointRef = useRef<LocationPoint | null>(null);

  const {
    isRunning,
    routePoints,
    setGPSMetrics,
    addRoutePoint,
    setLocationPermission,
    setGPSError,
    clearRoute,
    updateRunStats,
  } = useRunStore();

  /**
   * Calculate distance between two points using Haversine formula
   */
  const calculateDistance = useCallback((p1: LocationPoint, p2: LocationPoint): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (p1.latitude * Math.PI) / 180;
    const φ2 = (p2.latitude * Math.PI) / 180;
    const Δφ = ((p2.latitude - p1.latitude) * Math.PI) / 180;
    const Δλ = ((p2.longitude - p1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }, []);

  /**
   * Calculate total distance from all route points
   */
  const calculateTotalDistance = useCallback((points: LocationPoint[]): number => {
    if (points.length < 2) return 0;

    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += calculateDistance(points[i - 1], points[i]);
    }
    return total;
  }, [calculateDistance]);

  /**
   * Calculate current pace in min/km from speed
   */
  const calculatePace = useCallback((speedMps: number): number => {
    if (speedMps <= 0) return 0;
    const speedKmh = speedMps * 3.6;
    const paceMinPerKm = 60 / speedKmh;
    return paceMinPerKm;
  }, []);

  /**
   * Calculate average metrics from all route points
   */
  const calculateAverageMetrics = useCallback((points: LocationPoint[], totalDistance: number, duration: number): { avgSpeed: number; avgPace: number } => {
    if (duration === 0 || totalDistance === 0) {
      return { avgSpeed: 0, avgPace: 0 };
    }

    // Average speed = total distance / total time
    const avgSpeedMps = totalDistance / duration;
    const avgSpeedKmh = avgSpeedMps * 3.6;
    const avgPace = 60 / avgSpeedKmh;

    return { avgSpeed: avgSpeedKmh, avgPace };
  }, []);

  /**
   * Handle location error types
   */
  const handleLocationError = useCallback((error: any): LocationErrorType => {
    const message = error.message?.toLowerCase() || '';

    if (message.includes('permission')) return 'PERMISSION_DENIED';
    if (message.includes('provider') || message.includes('unavailable')) return 'PROVIDER_UNAVAILABLE';
    if (message.includes('timeout')) return 'TIMEOUT';
    if (message.includes('services') || message.includes('disabled')) return 'SERVICES_DISABLED';

    return 'UNKNOWN';
  }, []);

  /**
   * Show user-friendly error alert
   */
  const showErrorAlert = useCallback((errorType: LocationErrorType) => {
    switch (errorType) {
      case 'SERVICES_DISABLED':
        Alert.alert(
          'Location Services Disabled',
          'Please enable location services in your device settings to track your runs.',
          [{ text: 'OK' }]
        );
        break;
      case 'PERMISSION_DENIED':
        Alert.alert(
          'Location Permission Required',
          'Runna needs location access to track your runs. Please enable it in Settings.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Open Settings',
              onPress: () => {
                if (Platform.OS === 'ios') {
                  Linking.openURL('app-settings:');
                }
              },
            },
          ]
        );
        break;
      case 'PROVIDER_UNAVAILABLE':
        Alert.alert(
          'Location Unavailable',
          'Unable to determine your location. Make sure location services are enabled and try again.',
          [{ text: 'OK' }]
        );
        break;
      case 'TIMEOUT':
        Alert.alert(
          'Location Timeout',
          'Taking too long to get your location. Please try again.',
          [{ text: 'OK' }]
        );
        break;
      default:
        Alert.alert(
          'Location Error',
          'Unable to track your location. Please try again.',
          [{ text: 'OK' }]
        );
    }
  }, []);

  /**
   * Check and request location permissions
   */
  const requestPermissions = useCallback(async (): Promise<boolean> => {
    console.log('🔐 [GPS] Requesting location permissions...');

    try {
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      console.log('📍 [GPS] Location services enabled:', servicesEnabled);

      if (!servicesEnabled) {
        console.error('❌ [GPS] Location services are disabled');
        const errorType = handleLocationError({ message: 'Location services disabled' });
        showErrorAlert(errorType);
        setGPSError('Location services are disabled');
        setLocationPermission('denied');
        return false;
      }

      // Request foreground permissions
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
      console.log('🔐 [GPS] Permission status:', status, '| Can ask again:', canAskAgain);

      if (status === 'granted') {
        console.log('✅ [GPS] Location permission granted');
        setLocationPermission('granted');
        setGPSError(null);
        return true;
      } else {
        console.error('❌ [GPS] Location permission denied');
        setLocationPermission('denied');
        if (!canAskAgain) {
          const errorType = handleLocationError({ message: 'Location permission denied' });
          showErrorAlert(errorType);
        }
        setGPSError('Location permission denied');
        return false;
      }
    } catch (error) {
      console.error('❌ [GPS] Error requesting location permission:', error);
      const errorType = handleLocationError(error);
      showErrorAlert(errorType);
      setGPSError('Failed to request location permission');
      setLocationPermission('denied');
      return false;
    }
  }, [handleLocationError, showErrorAlert, setLocationPermission, setGPSError]);

  /**
   * Handle location update
   */
  const handleLocationUpdate = useCallback((location: Location.LocationObject) => {
    console.log('📍 [GPS] ========== NEW LOCATION UPDATE ==========');
    console.log('📍 [GPS] Raw location data:', {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      accuracy: location.coords.accuracy,
      timestamp: new Date(location.timestamp).toISOString(),
    });

    const point: LocationPoint = {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      altitude: location.coords.altitude,
      speed: location.coords.speed,
      heading: location.coords.heading,
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    };

    // Add point to route
    addRoutePoint(point);
    console.log('📍 [GPS] Point added to route');

    // Get current store state
    const store = useRunStore.getState();
    const currentPoints = [...store.routePoints, point];
    console.log('📍 [GPS] Total route points:', currentPoints.length);

    const totalDistance = calculateTotalDistance(currentPoints);
    console.log('📍 [GPS] Total distance calculated:', totalDistance, 'meters');

    // Calculate current speed and pace
    const currentSpeedMps = point.speed || 0;
    const currentSpeedKmh = Math.max(0, currentSpeedMps * 3.6);
    const currentPace = currentSpeedMps > 0 ? calculatePace(currentSpeedMps) : 0;
    console.log('📍 [GPS] Current speed:', currentSpeedKmh.toFixed(2), 'km/h');
    console.log('📍 [GPS] Current pace:', currentPace.toFixed(2), 'min/km');

    // Calculate running duration
    const duration = store.runStartTime
      ? Math.floor((Date.now() - store.runStartTime.getTime()) / 1000)
      : 0;
    console.log('📍 [GPS] Duration:', duration, 'seconds');

    // Calculate average metrics
    const { avgSpeed, avgPace } = calculateAverageMetrics(currentPoints, totalDistance, duration);
    console.log('📍 [GPS] Average speed:', avgSpeed.toFixed(2), 'km/h');
    console.log('📍 [GPS] Average pace:', avgPace.toFixed(2), 'min/km');

    // Update GPS metrics
    const metrics: GPSMetrics = {
      currentSpeed: currentSpeedKmh,
      currentPace,
      averageSpeed: avgSpeed,
      averagePace: avgPace,
      totalDistance,
      currentLocation: point,
    };

    console.log('📍 [GPS] Updating metrics in store:', {
      distance: (totalDistance / 1000).toFixed(3) + ' km',
      currentSpeed: currentSpeedKmh.toFixed(1) + ' km/h',
      currentPace: currentPace > 0 ? currentPace.toFixed(2) + ' min/km' : 'N/A',
      avgSpeed: avgSpeed.toFixed(1) + ' km/h',
      avgPace: avgPace > 0 ? avgPace.toFixed(2) + ' min/km' : 'N/A',
    });

    setGPSMetrics(metrics);

    // Update run stats in store
    updateRunStats(totalDistance, duration);
    console.log('📍 [GPS] Run stats updated');

    // Store last point for future calculations
    lastPointRef.current = point;

    console.log('✅ [GPS] Update complete - Distance:', (totalDistance / 1000).toFixed(3), 'km');
    console.log('📍 [GPS] ========================================');
  }, [addRoutePoint, calculateTotalDistance, calculatePace, calculateAverageMetrics, setGPSMetrics, updateRunStats]);

  /**
   * Start GPS tracking
   */
  const startTracking = useCallback(async () => {
    console.log('🚀 [GPS] ========== STARTING GPS TRACKING ==========');

    if (isTrackingRef.current) {
      console.warn('⚠️ [GPS] GPS tracking already active, skipping start');
      return;
    }

    console.log('🔧 [GPS] Platform:', Platform.OS);
    console.log('🔧 [GPS] Is Simulator:', __DEV__ && Platform.OS === 'ios');

    try {
      // Request permissions
      console.log('🔐 [GPS] Requesting permissions...');
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        console.error('❌ [GPS] Permission denied, cannot start tracking');
        return;
      }

      // Clear previous route data
      console.log('🧹 [GPS] Clearing previous route data...');
      clearRoute();

      // For simulator, use more frequent updates
      const isSimulator = __DEV__ && Platform.OS === 'ios';
      const trackingConfig = {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: isSimulator ? 1000 : 5000, // 1s for simulator, 5s for device
        distanceInterval: isSimulator ? 1 : 10,   // 1m for simulator, 10m for device
      };

      console.log('⚙️ [GPS] Tracking configuration:', trackingConfig);
      console.log('⏳ [GPS] Starting location watch...');

      // Start watching position with optimal settings for running
      subscriptionRef.current = await Location.watchPositionAsync(
        trackingConfig,
        (location) => {
          console.log('📡 [GPS] Location update received!');
          try {
            handleLocationUpdate(location);
          } catch (updateError) {
            console.error('❌ [GPS] Error in location update handler:', updateError);
            setGPSError('Error processing location update');
          }
        }
      );

      isTrackingRef.current = true;
      setGPSError(null);

      console.log('✅ [GPS] GPS tracking started successfully!');
      console.log('✅ [GPS] Subscription created:', !!subscriptionRef.current);
      console.log('✅ [GPS] Waiting for location updates...');

      if (isSimulator) {
        console.log('💡 [GPS] SIMULATOR DETECTED - Set location via:');
        console.log('   Features → Location → Custom Location (or City Run)');
      }
    } catch (error) {
      console.error('❌ [GPS] Error starting GPS tracking:', error);
      console.error('❌ [GPS] Error details:', JSON.stringify(error, null, 2));
      const errorType = handleLocationError(error);
      showErrorAlert(errorType);
      setGPSError('Failed to start GPS tracking');
      isTrackingRef.current = false;
    }
  }, [requestPermissions, clearRoute, handleLocationUpdate, handleLocationError, showErrorAlert, setGPSError]);

  /**
   * Stop GPS tracking
   */
  const stopTracking = useCallback(async () => {
    console.log('🛑 [GPS] ========== STOPPING GPS TRACKING ==========');

    if (!isTrackingRef.current) {
      console.warn('⚠️ [GPS] GPS tracking not active, nothing to stop');
      return;
    }

    try {
      if (subscriptionRef.current) {
        console.log('🔌 [GPS] Removing location subscription...');
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }

      isTrackingRef.current = false;
      lastPointRef.current = null;
      console.log('✅ [GPS] GPS tracking stopped successfully');
      console.log('✅ [GPS] Final route points:', useRunStore.getState().routePoints.length);
      console.log('✅ [GPS] Final distance:', (useRunStore.getState().gpsMetrics.totalDistance / 1000).toFixed(3), 'km');
    } catch (error) {
      console.error('❌ [GPS] Error stopping GPS tracking:', error);
      setGPSError('Error stopping GPS tracking');
    }
  }, [setGPSError]);

  /**
   * Auto-start/stop tracking based on run state
   */
  useEffect(() => {
    console.log('🔄 [GPS] Run state changed - isRunning:', isRunning, '| isTracking:', isTrackingRef.current);

    if (isRunning && !isTrackingRef.current) {
      console.log('▶️ [GPS] Run started, starting GPS tracking...');
      startTracking();
    } else if (!isRunning && isTrackingRef.current) {
      console.log('⏸️ [GPS] Run stopped, stopping GPS tracking...');
      stopTracking();
    }
  }, [isRunning, startTracking, stopTracking]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      isTrackingRef.current = false;
    };
  }, []);

  return {
    startTracking,
    stopTracking,
    isTracking: isTrackingRef.current,
    requestPermissions,
  };
}
