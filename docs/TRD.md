# Tinir — Technical Requirements Document (TRD)

| | |
|---|---|
| **Product** | Tinir (working title) |
| **Document** | Technical Requirements Document |
| **Version** | 0.2 (Aligned draft) |
| **Date** | 2026-11-05 |
| **Status** | Draft. The technology stack is a proposal pending team agreement. |
| **Related** | [Product Requirements Document (PRD)](./PRD.md) · [Functional and Non-Functional Requirements](./REQUIREMENTS.md) |

---

## 1. Purpose and Scope

This document turns the product requirements in the [PRD](./PRD.md) into a technical design for the Tinir backlog scope (US1–US14). It covers system architecture, technology stack, data model, API, security, and non-functional requirements. Feature IDs (F1–F7) refer to the PRD.

## 2. System Overview

The proposed client is a **mobile-first responsive web application**. Platform and stack selection remain subject to team agreement (backlog Prereq 5). PWA installation is a future option, not a baseline requirement. The backend design below supports the supplied requirements and backlog; it does not establish that these specific technologies have been approved.

```
┌─────────────────────────┐        HTTPS        ┌──────────────────────────────┐
│  Client (Web, proposed) │ ──────────────────▶ │  Web App Server (Next.js)    │
│  - Guest / Student /    │ ◀────────────────── │  - Pages (SSR/SSG)           │
│    Owner UI             │                     │  - REST API route handlers   │
└─────────────────────────┘                     │  - Auth middleware / RBAC    │
                                                └───────┬───────────┬──────────┘
                                                        │           │
                                              SQL (ORM) │           │ Signed upload URLs
                                                        ▼           ▼
                                           ┌──────────────┐  ┌──────────────────┐
                                           │  PostgreSQL  │  │  Object Storage  │
                                           │  (data)      │  │  (listing photos)│
                                           └──────────────┘  └──────────────────┘
                                                        │
                                                        ▼
                                           ┌─────────────────────────┐
                                           │ Email service (verify,  │
                                           │ follow-up reset/notifs) │
                                           └─────────────────────────┘
```

## 3. Technology Stack (Proposed)

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript | One language for frontend and backend; type safety |
| Frontend / Backend framework | Next.js (App Router) + React | Full-stack in one repo; SSR gives fast first load on mobile |
| Styling / UI | Tailwind CSS + shadcn/ui | Fast to build, consistent and accessible components |
| Database | PostgreSQL | Relational data (users, listings, inquiries) |
| ORM | Prisma or Drizzle | Typed queries and schema migrations |
| Authentication | Auth.js (NextAuth) credentials provider, or Supabase Auth | Email/password with sessions; supports roles |
| File storage | Supabase Storage / Cloudinary / S3-compatible | Image upload with signed URLs; free tier available |
| Email | Resend or similar | Required registration verification (Activity 4); password reset is a proposed follow-up |
| Validation | Zod | Shared validation schemas for client and server |
| Hosting | Vercel (app) + managed Postgres (Supabase/Neon) | Free tiers, automatic preview deployments |
| Testing | Vitest (unit), Playwright (E2E) | |
| CI | GitHub Actions | Lint, type-check, and test on every pull request |

> **Alternative:** If the team chooses a native mobile app (PRD §11, question 1), use React Native (Expo) for the client. The backend design in this document stays the same.

## 4. Architecture

### 4.1 Application Layers

- **Presentation:** React components and pages, grouped by role (`/` public, `/student/*`, `/owner/*`).
- **API:** REST route handlers under `/api/*`. They validate input with Zod and check auth and role.
- **Service:** business logic (for example, an owner may edit only their own listings).
- **Data access:** ORM models and migrations.

### 4.2 Proposed Repository Structure

```
tinir/
├── docs/                 # PRD, TRD, design docs
├── prisma/               # schema.prisma, migrations, seed
├── src/
│   ├── app/              # Next.js routes (pages + api)
│   │   ├── (public)/     # landing, listings, listing detail, login, signup
│   │   ├── student/      # inquiries, saved properties
│   │   ├── owner/        # dashboard, listing create/edit, inquiries
│   │   └── api/
│   ├── components/
│   ├── lib/              # auth, db client, storage, validation schemas
│   └── services/         # domain logic
├── tests/
└── public/
```

## 5. Data Model

### 5.1 Entity Relationship

```
User (1) ──< (N) Listing (1) ──< (N) ListingPhoto
 │                  │
 │                  ├──< (N) ListingAmenity >── (N) Amenity
 │                  │
 └──(student) ──< (N) Inquiry >── (1) Listing
                         │
                         └──< (N) InquiryMessage   (proposed follow-up)
```

A student also has many `saved_listings`, each linking to one Listing. A configured `campuses` row supplies the reference point for distance calculations.

### 5.2 Tables

The tables below describe an application-managed credentials design. If Supabase Auth is selected, credentials, sessions, and verification tokens belong to that provider; the application stores a linked user profile and enforces equivalent role/verification rules. Do not duplicate provider-managed password hashes.

#### `users`
| Column | Type | Constraints / Notes |
|---|---|---|
| id | UUID | PK |
| email | VARCHAR(255) | Unique, not null, stored lowercase |
| password_hash | VARCHAR | Required for application-managed credentials (bcrypt/argon2); absent from provider-linked profiles |
| role | ENUM(`student`, `owner`) | Not null |
| full_name | VARCHAR(120) | Not null |
| contact_number | VARCHAR(20) | Required for owners |
| college_program | VARCHAR(120) | Optional, students only |
| email_verified_at | TIMESTAMPTZ | Null until verified; required for protected role actions |
| created_at / updated_at | TIMESTAMPTZ | |

#### `listings`
| Column | Type | Constraints / Notes |
|---|---|---|
| id | UUID | PK |
| owner_id | UUID | FK → users.id, not null |
| title | VARCHAR(120) | Not null |
| property_type | ENUM(`bedspace`, `room`, `apartment`) | Not null |
| description | TEXT | |
| address | VARCHAR(255) | Not null |
| barangay / area | VARCHAR(100) | For filtering |
| latitude / longitude | DECIMAL(9,6) | Required for published listings supporting FR14; valid latitude [-90,90] and longitude [-180,180] |
| price_amount | INTEGER | In PHP centavos, > 0 when present; nullable when price is hidden |
| price_visible | BOOLEAN | Proposed default false; true requires a valid price. Hidden amounts are owner-only |
| price_period | ENUM(`monthly`, `semester`) | Default `monthly` |
| available_slots | INTEGER | Nullable, ≥ 0 |
| availability_status | ENUM(`available`, `full`) | Not null |
| status | ENUM(`draft`, `published`, `archived`) | Default `published` |
| house_rules | TEXT | Optional (curfew, visitors, etc.) |
| last_confirmed_at | TIMESTAMPTZ | Set on publication and explicit owner reconfirmation; drives semester reminders |
| created_at / updated_at | TIMESTAMPTZ | `updated_at` shown as "last updated" |

Indexes: `(status, property_type, price_amount)`, `(owner_id)`.

#### `listing_photos`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| listing_id | UUID | FK → listings.id, ON DELETE CASCADE |
| storage_key | VARCHAR | Object storage path |
| sort_order | SMALLINT | 0 = cover photo |

#### `amenities` / `listing_amenities`
- `amenities(id, name, icon)`: seeded list (Wi-Fi, aircon, own CR, kitchen, laundry, parking, study area, water included, electricity included, CCTV, etc.).
- `listing_amenities(listing_id, amenity_id)`: composite primary key.

#### `inquiries`
| Column | Type | Notes |
|---|---|---|
| id | UUID | PK |
| listing_id | UUID | FK → listings.id |
| student_id | UUID | FK → users.id |
| type | ENUM(`interest`, `question`) | "Express interest" vs. message |
| message | TEXT | Required when type = `question` |
| status | ENUM(`pending`, `accepted`, `rejected`) | Default `pending`; owner-controlled decision, not a booking |
| read_at / status_updated_at | TIMESTAMPTZ | Nullable read timestamp; timestamp of last decision |
| created_at | TIMESTAMPTZ | |

Constraint: one pending `interest` per `(listing_id, student_id)`, enforced by a partial unique index. Proposed transitions are Pending → Accepted/Rejected and Accepted/Rejected → Pending for corrections. Students cannot set status; every update checks listing ownership. Marking an inquiry read does not change its decision status.

#### `inquiry_messages` (proposed follow-up, outside core backlog)
`(id, inquiry_id, sender_id, body, created_at)`, used for in-app message threads.

#### `saved_listings` (FR13 / US13)
`(student_id, listing_id, created_at)`. Composite primary key `(student_id, listing_id)`; foreign keys to users and listings. Students may read/write only their own saved rows. Archived listings are omitted from the Saved Properties response without leaking private listing details.

#### `campuses` (FR14 / US14)
`(id, name, latitude, longitude)`. The team must confirm the UPV campus reference point before seeding coordinates. Each published listing requires coordinates captured with owner confirmation; no paid geocoding or route provider is assumed.

#### `email_verification_tokens`
For application-managed auth: `(id, user_id, token_hash, expires_at, consumed_at)`. Store only hashed random tokens; proposed expiry 24 hours, single use. Provider-managed verification replaces this table if selected.

#### Semester reminders
A configurable semester key and start date drive a scheduled job. Store `(listing_id, semester_key, sent_at)` in `listing_reminders` with a unique `(listing_id, semester_key)` key to avoid duplicate reminders. Owners see dashboard reminders for published listings not confirmed in the current semester. Email delivery is optional; dashboard delivery satisfies the proposed control. Dates must be configured from the team’s academic calendar.

## 6. API Specification

Base path: `/api`. Requests and responses use JSON. P1 endpoints are proposed follow-ups outside US1–US14. Errors use the format `{ "error": { "code": string, "message": string, "fields"?: {...} } }`.

### 6.1 Auth (F2, F3)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/auth/register` | Public | Body: `role`, `email`, `password`, `fullName`, role-specific fields. Returns 201 and sends a verification email; no activated role session yet. |
| POST | `/auth/login` | Public | Sets an HTTP-only session cookie; unverified accounts can only browse, verify, or resend verification |
| POST | `/auth/verify-email` | Public | Consume a valid single-use verification token; mark verified |
| POST | `/auth/resend-verification` | Public | Generic response to avoid account disclosure; rate-limited |
| POST | `/auth/logout` | Authenticated | Ends the session |
| GET | `/auth/me` | Authenticated | Returns the current user and role |
| POST | `/auth/forgot-password` | Public (P1) | Sends a reset email |
| POST | `/auth/reset-password` | Public (P1) | Token + new password |

### 6.2 Listings (F1, F4, F6, F7)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/listings` | Public | Published listings only; omit hidden prices and all owner contacts in list responses. Query: `type`, `minPrice`, `maxPrice`, `amenities[]`, `q`, `sort`, `page`, `pageSize` (default 20, max 50) |
| GET | `/listings/:id` | Public* | Listing detail. *Owner contacts require login; hidden price is omitted for all non-owners. Include approximate campus distance for authenticated students |
| POST | `/listings` | Owner | Create a listing |
| PATCH | `/listings/:id` | Owner (own) | Update fields, price visibility, or availability |
| POST | `/listings/:id/reconfirm` | Owner (own) | Set last-confirmed timestamp and dismiss current semester reminder |
| GET | `/owner/reminders` | Owner | Paginated semester reminders for own listings |
| DELETE | `/listings/:id` | Owner (own) | Soft delete (sets `status = archived`) |
| GET | `/owner/listings` | Owner | The owner's listings in any status |
| POST | `/listings/:id/photos/upload-url` | Owner (own) | Returns a signed upload URL |
| POST | `/listings/:id/photos` | Owner (own) | Saves the uploaded photo's metadata |
| PATCH | `/listings/:id/photos/order` | Owner (own) | Reorders photos / sets the cover |
| DELETE | `/listings/:id/photos/:photoId` | Owner (own) | Removes a photo |
| GET | `/amenities` | Public | The amenity list |

### 6.3 Inquiries (F5, F7.5)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| POST | `/listings/:id/inquiries` | Student | Body: `type` (`interest`/`question`), `message?` |
| GET | `/student/inquiries` | Student | Inquiries the student has sent |
| GET | `/owner/inquiries` | Owner | Inquiries on the owner's listings. Filter by `listingId`, `status` |
| PATCH | `/inquiries/:id` | Owner (listing owner) | Set Pending/Accepted/Rejected or mark read independently; enforce defined transitions |
| GET/POST | `/inquiries/:id/messages` | Participants (proposed follow-up) | Message thread |

### 6.4 Saved Properties (F4.7 / FR13)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| PUT | `/student/saved-listings/:listingId` | Student | Idempotently save a published listing |
| DELETE | `/student/saved-listings/:listingId` | Student | Idempotently remove own bookmark |
| GET | `/student/saved-listings` | Student | Paginated Saved Properties, with the same price/contact disclosure rules as listing views |

### 6.5 Campus Distance (F4.8 / FR14)

| Method | Endpoint | Access | Description |
|---|---|---|---|
| GET | `/listings/:id/distance?campusId=...` | Student | Return campus ID, distance in km, and method `straight_line` for a published listing |

Proposed implementation: Haversine calculation using confirmed listing/campus coordinates and Earth radius 6,371 km. Return an approximate straight-line distance rounded for display; do not present it as road distance or travel time. A map provider is unnecessary. Imported legacy data missing coordinates returns `distanceKm: null` with a clear unavailable reason; new publication requires coordinates. The exact method and campus point remain team decisions.

### 6.6 Disclosure and Workflow Rules

- Every protected student/owner endpoint requires a verified account; `/auth/me`, logout, verification, and resend remain available to unverified sessions. Owner contacts require login per NFR8.
- Use explicit response field lists. Hidden `price_amount` and its derived values must not appear in guest/student detail, list, saved-listing, metadata, or rendered page payloads. The owning owner’s management response may include them.
- Proposed price filtering: when min/max price is supplied, exclude hidden-price listings. Proposed price sorting places hidden-price listings last, ordered by posting date; their private amounts never determine public order. Visible prices are filterable normally. This reconciles optional pricing with FR12 and requires team confirmation.
- The owner chooses `price_visible` at creation/edit; a listing with no amount can publish when visibility is false. A visible price requires a positive amount. Switching to hidden takes effect on every response and invalidates cached public data.
- Owner inquiry history is restricted to inquiries on the requesting owner’s listings. No endpoint exposes a student’s activity with other owners.
- Dashboard inbox entries provide basic inquiry feedback; real-time chat and email/push notifications are follow-ups. Pending/Accepted/Rejected badges refresh on reload or refetch after an update; no real-time transport is assumed.

## 7. Security Requirements

| ID | Requirement |
|---|---|
| S1 | All traffic over HTTPS. |
| S2 | Hash passwords with bcrypt (cost ≥ 10) or argon2id. Never log or return them. |
| S3 | Sessions use HTTP-only, Secure, SameSite=Lax cookies. Session expiry: 7 days. |
| S4 | Check role-based access control (RBAC) on the server for every protected endpoint. Hiding UI elements is not enough. |
| S5 | Ownership checks: owners can modify only their own listings and photos. Students can see only their own inquiries. |
| S6 | Validate all input on the server with Zod. Use parameterized queries through the ORM to prevent SQL injection. |
| S7 | Escape output by default (React) to prevent XSS. Store user-entered descriptions as plain text. |
| S8 | Uploads: only JPEG/PNG/WebP, max 5 MB per image. Check MIME type and magic bytes. Strip EXIF metadata (it can contain GPS location). |
| S9 | Rate-limit login, registration, verification/resend, and inquiry endpoints (for example, 10 requests/min per IP for auth). |
| S10 | Owner contacts require login. Hidden prices are omitted for everyone except the owning owner in management screens; enforce disclosure on the server. |
| S11 | Store secrets in environment variables, never in the repository. |
| S12 | Data privacy: comply with RA 10173. Collect only the minimum data needed, and plan an account-deletion flow as a follow-up; do not represent this proposed endpoint as implemented. |

## 8. Non-Functional Requirements

Canonical source requirements are NFR1–NFR12 in REQUIREMENTS.md. Numeric targets beyond those sources (API latency, capacity, uptime, retention, accessibility level, and coverage) below are proposed engineering targets, not additional stakeholder approvals.

| Area | Requirement |
|---|---|
| Performance | Listings page LCP ≤ 3 s on a simulated 4G mobile connection. API p95 ≤ 500 ms for read endpoints. |
| Images | Serve resized, compressed images (WebP, responsive sizes) and lazy-load them below the fold. |
| Scalability | Handle ≥ 500 concurrent users. Paginate every list endpoint. |
| Availability | ≥ 99% uptime during the academic term (managed hosting). |
| Compatibility | Latest 2 versions of Chrome, Safari (iOS), Firefox, and Edge. Viewport width from 360 px up. |
| Accessibility | WCAG 2.1 AA for core flows. |
| Maintainability | ESLint + Prettier, strict TypeScript, pull request reviews required on `main`. |
| Consistency and feedback | Consistent role navigation and labels; readable text, clear empty/error/success states, and field-specific validation errors (NFR11–NFR12). |
| Observability | Server error logging and basic analytics (page views, inquiries sent). |
| Backups | Daily automated database backups, kept for 7 days. |

## 9. Testing Strategy

| Level | Scope | Tool |
|---|---|---|
| Unit | Validation schemas, ownership/verification rules, price redaction/filtering, Haversine calculation, inquiry transitions, idempotent saves | Vitest |
| Integration | API role/ownership enforcement, verification tokens, saved-listing isolation, private-price leakage through filters/caches, reminder deduplication against a test database | Vitest + test Postgres |
| End-to-end | Guest browse/contact restriction; registration/verification/login; student search/filter, inquiry/status, save/unsave, campus distance; owner create/edit/hide price, availability, reminders, inquiry decisions, removal | Playwright |
| Usability | Moderated tests with UPV students and owners | Manual (SUS questionnaire) |

Proposed target: ≥ 70% service-layer coverage. Verify all FR1–FR14 and NFR1–NFR12 acceptance criteria before delivery, including negative authorization and disclosure cases. Use fixtures for inquiry work before Sprint 4 listing creation, then validate the integrated owner-status flow in Sprint 5. Test the distance calculation with known coordinate pairs and same-point distance; test missing legacy coordinates explicitly.

## 10. Deployment and Environments

| Environment | Purpose | Trigger |
|---|---|---|
| Local | Development (Docker Postgres or a Supabase local instance) | — |
| Preview | Per-pull-request review | Push to a PR branch |
| Production | Live app | Merge to `main` |

The CI pipeline runs install, lint, type-check, unit/integration tests, build, and then deploy. Database migrations run during deployment.

## 11. Requirements Traceability

| Source | PRD feature | Technical components |
|---|---|---|
| FR1 / US1 | F1.1–F1.2 | Public list/detail routes; published-only query; disclosure serializer |
| FR2 / US6 | F1.3 | Guest inquiry login prompt; server authentication |
| FR3 / US2 | F2 | Registration, role validation, verification tokens/provider |
| FR4 / US3 | F3.1, F3.3 | Login/logout, secure sessions |
| FR5 / US4 | F3.2 | Server RBAC and role navigation |
| FR6 / US5, validation amendment | F4.2, F6.5 | Detail serializer, `price_visible`, hidden-price UI |
| FR7 / US7 | F5.1–F5.2 | Inquiry creation and owner inbox storage |
| FR8 / US8 | F5.3 | Student inquiry list; Pending/Accepted/Rejected badges |
| FR9 / US9 | F6 | Listing create, image upload, validation |
| FR10 / US10 | F7.1–F7.4 | Own listing CRUD/availability; soft removal |
| FR11 / US11 | F7.5 | Owner inbox, owner-only status updates |
| FR12 / US12 | F4.3–F4.4 | Keyword query and price/type/amenity filters |
| FR13 / US13 | F4.7 | `saved_listings`, save/unsave API, Saved Properties page |
| FR14 / US14 | F4.8 | Listing/campus coordinates, distance service and indicator |
| NFR1–NFR2 | §8 | Mobile performance and viewport checks |
| NFR3–NFR8 | §5, §8 | S1–S7, S10, S12; login-only owner contact serializer |
| NFR9–NFR10 | §8 | Daily backup configuration and browser checks |
| NFR11–NFR12 | §8 | Shared navigation/forms and clear operation feedback |
| Activity 4 risks 1, 3 | F2.6, F7.6–F7.7 | Semester reminder job, email verification, owner-scoped inquiry history |

## 12. Risks and Mitigations (Activity 4)

| Risk | Source likelihood / effect | Mitigation |
|---|---|---|
| 1. Inaccurate/outdated listings | High / Serious | Update timestamps, semester reconfirmation reminders, simple availability toggles |
| 2. Low owner adoption | High / Serious | Direct onboarding/consultations, free access tier, useful student-match examples |
| 3. Fake accounts/spam/no-show inquiries | Moderate / Tolerable | Required registration email verification, RBAC, history limited to inquiries received by the owner |
| 4. Scope creep | High / Serious | Follow US1–US14 and sprint goals; defer full chat and automated payments |
| 5. Illness/scheduling conflicts | Moderate / Serious | Clear GitHub task ownership, modular code, asynchronous review |
| 6. Data privacy non-compliance | Low / Catastrophic | Login-only contacts, minimal collection, secure database configuration |
| 7. Mobile/browser rendering issues | Moderate / Tolerable | Responsive layout; test Chrome/Safari/Firefox/Edge and small screens. NFR2 guarantees 360 px and up; narrower widths receive best-effort checks |
| 8. Database failure/data loss | Low / Catastrophic | Daily backups, reliable managed database, versioned schemas, restore checks |
| 9. Image/storage bottlenecks | Moderate / Tolerable | Client/server size validation, compression, cloud buckets, upload limits |
| 10. Unclear instructor/client expectations | Moderate / Serious | Regular activity-guide reviews and documented decisions/design artifacts |

Semester dates, scheduler support, email delivery, and daily backup capability must be checked against the selected hosting plan before relying on them. Free-tier availability alone does not prove these controls exist.

## 13. Open Technical Decisions

1. Confirm the web client and stack, including ORM, auth, storage, and hosting. PWA installation is a future option.
2. Confirm the campus reference point and straight-line versus routed distance method before FR14 acceptance.
3. Confirm hidden-price filtering/sorting behavior and the proposed default-hidden setting.
4. Confirm inquiry status correction rules and owner-scoped inquiry-history presentation; accepted inquiries do not reserve rooms.
5. Select a scheduler and configure semester dates, reminder delivery, verification email expiry/resend limits, and daily backup/restore procedures.
6. Additional owner verification, admin moderation, full chat, password reset, and account deletion are follow-up proposals with separate acceptance criteria, not committed US1–US14 features.

## 14. Source Basis and Delivery Plan

Use PRD §12 for the supplied Sprint 1–5 schedule and PRD §§13–14 for source provenance and reconciliation decisions. ACT 2 IDs are preserved in REQUIREMENTS.md and mapped above. The local PDF snapshots take precedence over assumptions from the earlier draft; no live spreadsheet state or new stakeholder approval is asserted. The technical stack and engineering targets remain proposals.
