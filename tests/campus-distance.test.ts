import { describe, expect, it } from 'vitest';
import { distanceLabel, readCampusDistances, type DistanceReads } from '../src/services/campus-distance';
import type { Campus } from '../src/services/contracts';

// Synthetic reference points; real campus coordinates are configured in the database.
const campuses: Campus[] = [
  { id: 'a', name: 'Synthetic campus A', latitude: 10, longitude: 120 },
  { id: 'b', name: 'Synthetic campus B', latitude: 11, longitude: 121 },
];
const reads = (overrides: Partial<DistanceReads> = {}): DistanceReads => ({
  campuses: async () => campuses,
  distance: async (_listingId, campusId) => ({ campus_id: campusId, distance_km: campusId === 'a' ? 1.25 : 0, method: 'straight_line' }),
  ...overrides,
});

describe('campus distance (FR14, NFR12)', () => {
  it('labels distances as approximate kilometres', () => {
    expect(distanceLabel(1.25)).toBe('About 1.25 km');
    expect(distanceLabel(2)).toBe('About 2.00 km');
    expect(distanceLabel(0)).toBe('Less than 0.01 km');
    expect(distanceLabel(null)).toBe('Distance unavailable');
  });

  it('returns the server distance for every configured campus, in the server order', async () => {
    expect(await readCampusDistances('listing', reads())).toEqual({
      status: 'ready',
      distances: [
        { campusId: 'a', campusName: 'Synthetic campus A', km: 1.25 },
        { campusId: 'b', campusName: 'Synthetic campus B', km: 0 },
      ],
    });
  });

  it('says the campus is not set up, without asking for a distance', async () => {
    let asked = false;
    const state = await readCampusDistances('listing', reads({
      campuses: async () => [],
      distance: async () => { asked = true; return { distance_km: null, method: 'straight_line' }; },
    }));
    expect(state).toEqual({ status: 'not-configured' });
    expect(asked).toBe(false);
  });

  it('keeps a missing distance distinct from zero', async () => {
    const state = await readCampusDistances('listing', reads({
      distance: async () => ({ distance_km: null, reason: 'CAMPUS_NOT_CONFIGURED', method: 'straight_line' }),
    }));
    expect(state).toMatchObject({ status: 'ready', distances: [{ km: null }, { km: null }] });
  });

  it('reports a failed read without exposing raw diagnostics', async () => {
    const state = await readCampusDistances('listing', reads({
      distance: async () => { throw { code: 'XX000', message: 'relation app_private.campuses broke' }; },
    }));
    expect(state.status).toBe('error');
    expect(JSON.stringify(state)).not.toContain('app_private');
  });
});
