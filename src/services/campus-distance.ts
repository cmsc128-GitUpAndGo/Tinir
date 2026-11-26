import type { Campus, Distance } from './contracts';
import { backendError } from './errors';

export interface CampusDistance {
  campusId: string;
  campusName: string;
  /** Null when the server has no distance for this campus, e.g. it was removed after the list was read. */
  km: number | null;
}

/** What the campus distance block on a listing shows (FR14). */
export type CampusDistanceState =
  | { status: 'loading' }
  | { status: 'ready'; distances: CampusDistance[] }
  /** No campus reference point is set up yet. Retrying does not help until the team configures one. */
  | { status: 'not-configured' }
  | { status: 'error'; message: string };

export interface DistanceReads {
  campuses: () => Promise<Campus[]>;
  distance: (listingId: string, campusId: string) => Promise<Distance>;
}

/** FR14: the server's straight-line figure, always marked as approximate and labeled in km. */
export function distanceLabel(km: number | null): string {
  if (km === null) return 'Distance unavailable';
  if (km < 0.01) return 'Less than 0.01 km';
  return `About ${km.toFixed(2)} km`;
}

/**
 * Asks the server for the distance from one listing to every configured campus (FR14). The app never
 * calculates it or assumes a campus location of its own.
 */
export async function readCampusDistances(listingId: string, reads: DistanceReads): Promise<CampusDistanceState> {
  try {
    const campuses = await reads.campuses();
    if (!campuses.length) return { status: 'not-configured' };
    const distances = await Promise.all(campuses.map(async (campus) => {
      const { distance_km } = await reads.distance(listingId, campus.id);
      return { campusId: campus.id, campusName: campus.name, km: distance_km };
    }));
    return { status: 'ready', distances };
  } catch (error) {
    return { status: 'error', message: backendError(error).error.message };
  }
}
