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
    try {
      // Check if location services are enabled
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        const errorType = handleLocationError({ message: 'Location services disabled' });
        showErrorAlert(errorType);
        setGPSError('Location services are disabled');
        setLocationPermission('denied');
        return false;
      }

      // Request foreground permissions
      const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();

      if (status === 'granted') {
        setLocationPermission('granted');
        setGPSError(null);
        return true;
      } else {
        setLocationPermission('denied');
        if (!canAskAgain) {
          const errorType = handleLocationError({ message: 'Location permission denied' });
          showErrorAlert(errorType);
        }
        setGPSError('Location permission denied');
        return false;
      }
    } catch (error) {
      console.error('Error requesting location permission:', error);
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

    // Get current store state
    const store = useRunStore.getState();
    const currentPoints = [...store.routePoints, point];
    const totalDistance = calculateTotalDistance(currentPoints);

    // Calculate current speed and pace
    const currentSpeedMps = point.speed || 0;
    const currentSpeedKmh = Math.max(0, currentSpeedMps * 3.6);
    const currentPace = currentSpeedMps > 0 ? calculatePace(currentSpeedMps) : 0;

    // Calculate running duration
    const duration = store.runStartTime
      ? Math.floor((Date.now() - store.runStartTime.getTime()) / 1000)
      : 0;

    // Calculate average metrics
    const { avgSpeed, avgPace } = calculateAverageMetrics(currentPoints, totalDistance, duration);

    // Update GPS metrics
    const metrics: GPSMetrics = {
      currentSpeed: currentSpeedKmh,
      currentPace,
      averageSpeed: avgSpeed,
      averagePace: avgPace,
      totalDistance,
      currentLocation: point,
    };

    setGPSMetrics(metrics);

    // Update run stats in store
    updateRunStats(totalDistance, duration);

    // Store last point for future calculations
    lastPointRef.current = point;

    console.log('GPS Update:', {
      distance: (totalDistance / 1000).toFixed(2) + ' km',
      speed: currentSpeedKmh.toFixed(1) + ' km/h',
      pace: currentPace > 0 ? currentPace.toFixed(2) + ' min/km' : 'N/A',
      accuracy: point.accuracy?.toFixed(1) + ' m',
    });
  }, [addRoutePoint, calculateTotalDistance, calculatePace, calculateAverageMetrics, setGPSMetrics, updateRunStats]);

  /**
   * Start GPS tracking
   */
  const startTracking = useCallback(async () => {
    if (isTrackingRef.current) {
      console.warn('GPS tracking already active');
      return;
    }

    try {
      // Request permissions
      const hasPermission = await requestPermissions();
      if (!hasPermission) {
        return;
      }

      // Clear previous route data
      clearRoute();

      // Start watching position with optimal settings for running
      subscriptionRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 5000, // Update every 5 seconds
          distanceInterval: 10, // Update if moved 10 meters
        },
        (location) => {
          try {
            handleLocationUpdate(location);
          } catch (updateError) {
            console.error('Error in location update handler:', updateError);
            setGPSError('Error processing location update');
          }
        }
      );

      isTrackingRef.current = true;
      setGPSError(null);
      console.log('✅ GPS tracking started successfully');
    } catch (error) {
      console.error('❌ Error starting GPS tracking:', error);
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
    if (!isTrackingRef.current) {
      console.warn('GPS tracking not active');
      return;
    }

    try {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }

      isTrackingRef.current = false;
      lastPointRef.current = null;
      console.log('✅ GPS tracking stopped successfully');
    } catch (error) {
      console.error('❌ Error stopping GPS tracking:', error);
      setGPSError('Error stopping GPS tracking');
    }
  }, [setGPSError]);

  /**
   * Auto-start/stop tracking based on run state
   */
  useEffect(() => {
    if (isRunning && !isTrackingRef.current) {
      startTracking();
    } else if (!isRunning && isTrackingRef.current) {
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
