/**
 * Run data management utilities
 * Handles saving runs locally and uploading to Strava
 */

import { supabase } from './supabase';
import type { Activity, LocationPoint } from '../types';

export interface SaveRunParams {
  userId: string;
  name: string;
  startTime: Date;
  distanceMeters: number;
  movingTimeSeconds: number;
  elapsedTimeSeconds: number;
  averageSpeed: number;
  maxSpeed: number;
  routePoints: LocationPoint[];
  stravaActivityId?: number | null;
}

/**
 * Save a run to the local database
 * Can be used for runs that are uploaded to Strava or local-only runs
 */
export async function saveRunLocally(params: SaveRunParams): Promise<Activity> {
  console.log('💾 [Runs] Saving run locally...', {
    name: params.name,
    distance: `${(params.distanceMeters / 1000).toFixed(2)} km`,
    duration: `${Math.floor(params.elapsedTimeSeconds / 60)}:${(params.elapsedTimeSeconds % 60).toString().padStart(2, '0')}`,
    stravaId: params.stravaActivityId || 'local only',
  });

  const activityRecord = {
    user_id: params.userId,
    strava_activity_id: params.stravaActivityId || null,
    name: params.name,
    type: 'Run',
    distance_meters: params.distanceMeters,
    moving_time_seconds: params.movingTimeSeconds,
    elapsed_time_seconds: params.elapsedTimeSeconds,
    start_date: params.startTime.toISOString(),
    average_speed: params.averageSpeed,
    max_speed: params.maxSpeed,
    average_heartrate: null, // Not available from GPS tracking
    max_heartrate: null,
    calories: null,
    elevation_gain: null, // Could calculate from altitude data if needed
    raw_data: {
      source: 'runna_gps_tracking',
      route_points: params.routePoints,
      recorded_at: new Date().toISOString(),
    },
  };

  const { data, error } = await supabase
    .from('activities')
    .insert(activityRecord)
    .select()
    .single();

  if (error) {
    console.error('❌ [Runs] Failed to save run locally:', error);
    throw new Error(`Failed to save run: ${error.message}`);
  }

  console.log('✅ [Runs] Run saved locally with ID:', data.id);
  return data;
}

/**
 * Generate a run name based on the time of day
 */
export function generateRunName(startTime: Date): string {
  const hour = startTime.getHours();

  if (hour >= 5 && hour < 12) {
    return 'Morning Run';
  } else if (hour >= 12 && hour < 17) {
    return 'Afternoon Run';
  } else if (hour >= 17 && hour < 21) {
    return 'Evening Run';
  } else {
    return 'Night Run';
  }
}

/**
 * Format run stats for display
 */
export function formatRunStats(distanceMeters: number, durationSeconds: number): string {
  const distanceKm = (distanceMeters / 1000).toFixed(2);
  const minutes = Math.floor(durationSeconds / 60);
  const seconds = durationSeconds % 60;
  const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  return `Distance: ${distanceKm} km | Duration: ${timeStr}`;
}
