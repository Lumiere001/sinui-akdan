import type { Location, PlayerPosition } from './shared/types.js';
import { getLocation } from './gameData.js';

/**
 * GPS proximity checking utilities
 * Implements Haversine formula for distance calculation
 * and proximity state detection
 */

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lng1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lng2 - Longitude of point 2
 * @returns Distance in meters
 */
export function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Convert degrees to radians
 */
function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Proximity state type
 */
export type ProximityState = 'inside' | 'approaching' | 'outside';

/**
 * Check proximity of a player to a location
 * @param playerPos - Player position
 * @param location - Location to check against
 * @returns Proximity state: 'inside' (unlockRadius), 'approaching' (approachRadius), 'outside'
 */
export function checkProximity(playerPos: PlayerPosition, location: Location): ProximityState {
  const distance = getDistance(playerPos.lat, playerPos.lng, location.lat, location.lng);

  if (distance <= location.unlockRadius) {
    return 'inside';
  } else if (distance <= location.approachRadius) {
    return 'approaching';
  } else {
    return 'outside';
  }
}

/**
 * Check team presence at a location
 * Counts how many team members are within the team check radius (50m)
 * and determines if minimum required members (3) are present
 *
 * @param teamId - Team ID
 * @param locationId - Location ID to check
 * @param gameState - Current game state
 * @param gameData - Game configuration data
 * @returns Object with member count, required count, and sufficiency status
 */
export interface TeamPresenceResult {
  count: number;
  needed: number;
  sufficient: boolean;
}

export function checkTeamPresence(
  teamId: number,
  locationId: string,
  gameStateManager: any,
): TeamPresenceResult {
  const TEAM_CHECK_RADIUS = 40; // meters (unlockRadius와 동일)
  const REQUIRED_MEMBERS = 3;

  const location = getLocation(locationId);
  if (!location) {
    return { count: 0, needed: REQUIRED_MEMBERS, sufficient: false };
  }

  const teamMembers = gameStateManager.getTeamMembers(teamId);
  let membersInRadius = 0;

  // Count team members within the team check radius
  for (const member of teamMembers) {
    const distance = getDistance(member.lat, member.lng, location.lat, location.lng);
    if (distance <= TEAM_CHECK_RADIUS) {
      membersInRadius++;
    }
  }

  return {
    count: membersInRadius,
    needed: REQUIRED_MEMBERS,
    sufficient: membersInRadius >= REQUIRED_MEMBERS,
  };
}

/**
 * Validate location ID exists in game data
 */
export function isValidLocation(locationId: string): boolean {
  return getLocation(locationId) !== undefined;
}
