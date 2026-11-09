import { describe, expect, it } from 'vitest';

import { access, visibleAreas, type Area, type Viewer } from '../src/services/access';
import type { Profile, Role } from '../src/services/contracts';

const member = (role: Role, email_verified = true): Viewer => ({
  kind: 'member',
  profile: { id: 'u1', role, email_verified, full_name: 'Fictional', email: 'f@example.test', contact_number: null, college_program: null } satisfies Profile,
});
const guest: Viewer = { kind: 'guest' };

describe('visibleAreas (FR5 navigation)', () => {
  it('gives each role its own tabs', () => {
    expect(visibleAreas(guest)).toEqual(['browse', 'account']);
    expect(visibleAreas(member('student'))).toEqual(['browse', 'saved', 'inquiries', 'account']);
    expect(visibleAreas(member('owner'))).toEqual(['browse', 'my-listings', 'inquiries', 'account']);
  });
  it('keeps role tabs visible while unverified so the screen can explain why', () => {
    expect(visibleAreas(member('student', false))).toEqual(visibleAreas(member('student')));
  });
  it('shows only public tabs while loading or when the profile is unavailable', () => {
    expect(visibleAreas({ kind: 'loading' })).toEqual(['browse', 'account']);
    expect(visibleAreas({ kind: 'unknown', message: 'offline' })).toEqual(['browse', 'account']);
  });
});

describe('access (FR5 direct navigation)', () => {
  const reason = (area: Area, viewer: Viewer) => {
    const result = access(area, viewer);
    return result.allowed ? 'allowed' : result.reason;
  };
  it('lets everyone browse and open their account', () => {
    for (const viewer of [guest, member('student'), member('owner')]) {
      expect(reason('browse', viewer)).toBe('allowed');
      expect(reason('account', viewer)).toBe('allowed');
    }
  });
  it('asks guests to log in for role areas', () => {
    for (const area of ['saved', 'inquiries', 'my-listings'] as const) expect(reason(area, guest)).toBe('login');
  });
  it('denies the wrong role', () => {
    expect(reason('my-listings', member('student'))).toBe('wrong-role');
    expect(reason('saved', member('owner'))).toBe('wrong-role');
  });
  it('allows the right role', () => {
    expect(reason('saved', member('student'))).toBe('allowed');
    expect(reason('inquiries', member('student'))).toBe('allowed');
    expect(reason('my-listings', member('owner'))).toBe('allowed');
    expect(reason('inquiries', member('owner'))).toBe('allowed');
  });
  it('requires a verified email for role areas', () => {
    expect(reason('saved', member('student', false))).toBe('unverified');
    expect(reason('my-listings', member('owner', false))).toBe('unverified');
    // The wrong role is reported first, so an unverified owner is not told to verify for a student page.
    expect(reason('saved', member('owner', false))).toBe('wrong-role');
  });
  it('waits while the account loads', () => {
    expect(reason('saved', { kind: 'loading' })).toBe('loading');
    expect(reason('saved', { kind: 'unknown', message: 'offline' })).toBe('unknown');
  });
});
