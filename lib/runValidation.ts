/**
 * Run data validation utilities
 * Validates run data before uploading to Strava or saving locally
 */

export interface RunValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface RunDataToValidate {
  distanceMeters: number;
  durationSeconds: number;
  routePointsCount: number;
  startTime?: Date;
}

const MINIMUM_DISTANCE_METERS = 100; // 0.1 km
const MINIMUM_DURATION_SECONDS = 60; // 1 minute
const MINIMUM_GPS_POINTS = 5;
const MAXIMUM_PACE_MIN_PER_KM = 1; // 60 km/h (sprinting speed)
const MAXIMUM_DISTANCE_METERS = 100000; // 100 km

export function validateRunData(data: RunDataToValidate): RunValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check minimum distance
  if (data.distanceMeters < MINIMUM_DISTANCE_METERS) {
    errors.push(
      `Run too short to upload (minimum ${MINIMUM_DISTANCE_METERS}m, got ${Math.round(data.distanceMeters)}m)`
    );
  }

  // Check minimum duration
  if (data.durationSeconds < MINIMUM_DURATION_SECONDS) {
    errors.push(
      `Run too short to upload (minimum ${MINIMUM_DURATION_SECONDS}s, got ${data.durationSeconds}s)`
    );
  }

  // Check minimum GPS points
  if (data.routePointsCount < MINIMUM_GPS_POINTS) {
    errors.push(
      `Insufficient GPS data (minimum ${MINIMUM_GPS_POINTS} points, got ${data.routePointsCount})`
    );
  }

  // Check for valid start time (not in the future)
  if (data.startTime) {
    const now = new Date();
    if (data.startTime > now) {
      errors.push('Invalid start time - run cannot start in the future');
    }
  }

  // If we have valid distance and duration, calculate pace
  if (data.distanceMeters >= MINIMUM_DISTANCE_METERS && data.durationSeconds >= MINIMUM_DURATION_SECONDS) {
    const paceMinPerKm = (data.durationSeconds / data.distanceMeters) * 1000 / 60;

    // Check for unrealistic pace (too fast)
    if (paceMinPerKm < MAXIMUM_PACE_MIN_PER_KM) {
      warnings.push(
        `Unusual pace detected (${paceMinPerKm.toFixed(2)} min/km) - GPS may be inaccurate. This is faster than typical sprinting speed.`
      );
    }

    // Check for very long distance
    if (data.distanceMeters > MAXIMUM_DISTANCE_METERS) {
      warnings.push(
        `Very long distance detected (${(data.distanceMeters / 1000).toFixed(1)} km) - please verify GPS accuracy.`
      );
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Format validation results for display
 */
export function formatValidationErrors(validation: RunValidation): string {
  if (validation.isValid) return '';
  return validation.errors.join('\n');
}

export function formatValidationWarnings(validation: RunValidation): string {
  if (validation.warnings.length === 0) return '';
  return validation.warnings.join('\n');
}
