import type { Profile, Role } from './contracts';

/**
 * FR5 client-side access model (PRD §5). It decides navigation and what a screen shows; it is never the
 * security boundary. The database checks identity, verification, role and ownership on every request.
 */
export type Viewer =
  | { kind: 'loading' }
  | { kind: 'guest' }
  /** Logged in, but the profile could not be loaded; only public areas are shown. */
  | { kind: 'unknown'; message: string }
  | { kind: 'member'; profile: Profile };

export type Area = 'browse' | 'account' | 'saved' | 'inquiries' | 'my-listings';

/** Which roles each area is for. Guests only ever get the public areas. */
const AREA_ROLES: Record<Area, readonly Role[] | 'public'> = {
  browse: 'public',
  account: 'public',
  saved: ['student'],
  inquiries: ['student', 'owner'],
  'my-listings': ['owner'],
};

/** Tab order is the same for every role; each role sees its own subset. */
export const AREA_ORDER: readonly Area[] = ['browse', 'saved', 'my-listings', 'inquiries', 'account'];

export type Access =
  | { allowed: true }
  | { allowed: false; reason: 'loading' | 'login' | 'wrong-role' | 'unverified' | 'unknown' };

export function access(area: Area, viewer: Viewer): Access {
  const roles = AREA_ROLES[area];
  if (roles === 'public') return { allowed: true };
  switch (viewer.kind) {
    case 'loading': return { allowed: false, reason: 'loading' };
    case 'guest': return { allowed: false, reason: 'login' };
    case 'unknown': return { allowed: false, reason: 'unknown' };
    case 'member':
      if (!roles.includes(viewer.profile.role)) return { allowed: false, reason: 'wrong-role' };
      // Role areas need a verified email (PRD §5, Activity 4 risk 3); the server enforces the same rule.
      if (!viewer.profile.email_verified) return { allowed: false, reason: 'unverified' };
      return { allowed: true };
  }
}

/**
 * Areas shown in the tab bar. Role areas stay visible while the email is unverified, so the screen can
 * explain the verification step instead of the feature silently missing.
 */
export function visibleAreas(viewer: Viewer): Area[] {
  const role = viewer.kind === 'member' ? viewer.profile.role : null;
  return AREA_ORDER.filter((area) => {
    const roles = AREA_ROLES[area];
    return roles === 'public' || (role !== null && roles.includes(role));
  });
}
