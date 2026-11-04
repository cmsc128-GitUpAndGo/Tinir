# Tinir — Functional and Non-Functional Requirements

| | |
|---|---|
| **Product** | Tinir (working title) |
| **Document** | Functional and Non-Functional Requirements Specification |
| **Version** | 0.2 (Aligned draft) |
| **Date** | 2026-11-05 |
| **Status** | Aligned to supplied ACT 2 validation, backlog, and Activity 4; revised documents not yet re-approved |
| **Related** | [PRD](./PRD.md) · [TRD](./TRD.md) |

## 1. Basis and Interpretation

FR1–FR14 and NFR1–NFR12 preserve the identifiers in `ACT 2.pdf` and the supplied product backlog. The earlier Markdown draft used FR1–FR48 and NFR1–NFR38 for implementation details; that numbering is superseded to avoid collisions with the submitted activities. Acceptance criteria and technical limits below elaborate the source requirements and are design proposals where the PDFs do not prescribe a detail.

The sources are `CMSC_128_Activity.pdf` (interviews/proposal), `ACT 2.pdf` (requirements and validation), `ACT 3.pdf` (spreadsheet link), `TINIR_ProductBacklog - Product_Backlog.pdf` (story priorities/sprints), and `act 4.pdf` (risk management), supplied from `/home/dejel/Documents/UPV/TINIR-128/`. The live spreadsheet was not verified.

ACT 2 records approval by Anne Nonato (property owner representative) and James Ivan Villar (student representative), with FR6 to be updated so owners can choose whether to show prices. This amendment is applied here even though the backlog retains the earlier price-display wording. Pending/Accepted/Rejected statuses follow backlog US8. Email verification and semester reminders follow Activity 4 and are not yet assigned sprints in the supplied backlog.

Actors are Guest (not logged in), Student, Property Owner, and System. Owner contacts require login. Protected student/owner actions require email verification; verification does not establish student enrollment or property ownership.

## 2. Functional Requirements

### FR1: Guests can browse published listings without an account.

Acceptance criteria: Opening the listings page while logged out shows published accommodation summaries; draft and archived listings are excluded.

### FR2: Guests are asked to log in or sign up before sending an inquiry.

Acceptance criteria: A guest clicking Inquire or Express Interest receives a login/sign-up prompt; direct unauthenticated inquiry requests are rejected.

### FR3: Users can register as a Student or a Property Owner.

Acceptance criteria: The registration form requires role selection and validates required fields. Registration sends a verification email; protected role actions remain unavailable until verification, following Activity 4 risk 3.

### FR4: Users can log in and log out with their email and password.

Acceptance criteria: Valid credentials start a secure session; invalid credentials give a generic error. Logout ends the session. An unverified account may browse and complete verification but cannot use protected student/owner actions.

### FR5: Users can access only the features for their role.

Acceptance criteria: Role navigation reflects the account type, and the server denies protected actions for the wrong role. Owners can change only their own listings and received inquiries; students can access only their own inquiry and saved-listing records.

### FR6: Students can view listing details: location, photos, amenities, availability, and price when the owner chooses to disclose it.

Acceptance criteria: The detail view displays supplied information and house rules. Owners can change price visibility. A hidden price displays Contact owner for price; the numeric amount is absent from all non-owner responses, rendered payloads, and metadata. Owner contacts require login (NFR8).

### FR7: Students can send inquiries to property owners.

Acceptance criteria: A verified student can submit a non-empty question or express interest on a published listing. The inquiry is saved, starts Pending, and appears in the owner inbox. Duplicate pending expressions of interest are prevented.

### FR8: Students can see the status of their inquiries.

Acceptance criteria: My Inquiries shows the student’s sent inquiries with Pending, Accepted, or Rejected badges, refreshed on reload/refetch. An owner decision is reflected in the student view. Accepted does not guarantee a booking or room.

### FR9: Owners can create listings with details and photos.

Acceptance criteria: A verified owner can create a listing with title, type, address, description, amenities, photos, availability, and the price-visibility choice. A hidden or omitted price does not block publication; visible prices must be valid. Listing coordinates support FR14.

### FR10: Owners can edit, update availability of, and remove their own listings.

Acceptance criteria: The owner dashboard lists only the owner’s records. Edits appear in listing views, availability can change between Available/Full, and confirmed removal excludes a listing publicly. Attempts to change another owner’s listing are denied.

### FR11: Owners can view the inquiries they receive and update their status.

Acceptance criteria: The owner inbox groups/filters received inquiries by listing and permits Pending/Accepted/Rejected updates. The server enforces listing ownership. Student views reflect the saved decision; unrelated owners cannot see the inquiry.

### FR12: Students can search accommodation listings by keyword and filter results by price range, room type, and amenities.

Acceptance criteria: The search bar and filters update published results correctly, including combined criteria and empty-result feedback. Proposed hidden-price handling excludes hidden-price listings whenever a price range is applied; private prices are never used to determine public filtering/order.

### FR13: Students can save accommodation listings and view their saved listings later.

Acceptance criteria: A bookmark action saves/unsaves a listing for the current student without duplicates. Saved Properties persists across sessions, shows only that student’s saved published listings, and respects price/contact disclosure. Archived listings do not expose private details.

### FR14: Students can calculate distance between a selected accommodation and the campus location.

Acceptance criteria: A property detail view shows an approximate distance to the configured UPV campus reference point. Proposed method: straight-line Haversine distance, explicitly labeled in km. Confirm the campus point and method before acceptance; a map snippet is optional.

## 3. Non-Functional Requirements

### NFR1: The listings page loads within 3 seconds on a mobile 4G connection.

Acceptance criteria: Measure the listings page using a documented mobile 4G profile; proposed metric is Largest Contentful Paint. Record conditions and results.

### NFR2: The interface is mobile-first and usable on screens 360 px wide and up.

Acceptance criteria: Core guest, student, and owner flows work at 360 px and representative larger widths without clipped controls or horizontal page overflow.

### NFR3: All communication uses HTTPS.

Acceptance criteria: Deployed app/API endpoints use HTTPS and session cookies are Secure.

### NFR4: Passwords are stored securely hashed.

Acceptance criteria: Application-managed credentials use bcrypt or argon2id; passwords are never logged or returned. With provider-managed auth, verify equivalent credential protection and do not duplicate hashes locally.

### NFR5: Role and ownership checks run on the server for every protected request.

Acceptance criteria: Direct requests with a wrong role, wrong owner, or another student’s record are denied even when UI checks are bypassed.

### NFR6: All input is validated on the server and protected against SQL injection and XSS.

Acceptance criteria: Invalid payloads are rejected; parameterized database access is used and user-entered text is safely rendered. Form errors identify the affected field.

### NFR7: The system complies with the Philippine Data Privacy Act of 2012 and collects only the data it needs.

Acceptance criteria: Review collected fields, access rules, logging, and privacy notice against the project’s purposes. Avoid exposing personal data in responses or logs; this review is not a claim of legal certification.

### NFR8: Owner contact details are visible only to logged-in users.

Acceptance criteria: Guest list/detail responses, initial page payloads, metadata, and cached pages do not expose owner email/contact numbers. Authenticated detail access can show owner contacts; hidden prices remain protected separately.

### NFR9: The database is backed up daily.

Acceptance criteria: Verify a scheduled daily backup exists on the chosen plan and demonstrate restoring a backup to a separate test database.

### NFR10: The system works on the latest versions of Chrome, Safari, Firefox, and Edge.

Acceptance criteria: Record the tested browser versions and validate core flows, including Safari on iOS; the proposed engineering target is the latest two versions.

### NFR11: The system uses consistent navigation, readable text, clearly labeled controls, and understandable error messages across guest, student, and property-owner screens.

Acceptance criteria: Review shared navigation, controls, and error wording across the three roles at mobile widths.

### NFR12: The system displays clear feedback when an operation fails, required fields are missing, or submitted data is invalid.

Acceptance criteria: Exercise invalid forms, failed uploads, network/server failures, and empty states; show actionable feedback without exposing stack traces.

## 4. Backlog Traceability and Delivery

High / Medium / Low match the supplied backlog. A Low-priority story remains committed when scheduled; saved listings and distance are not future-only features.

| Requirement | Story | PRD feature | Priority | Sprint |
|---|---|---|---|---|
| FR1 | US1 | F1.1–F1.2 | High | 2 |
| FR2 | US6 | F1.3 | Medium | 3 |
| FR3 | US2 | F2 | High | 2 |
| FR4 | US3 | F3.1, F3.3 | High | 2 |
| FR5 | US4 | F3.2 | Medium | 2 |
| FR6 | US5 | F4.2, F6.5 | High | 3 |
| FR7 | US7 | F5.1–F5.2 | High | 3 |
| FR8 | US8 | F5.3 | Medium | 3 |
| FR9 | US9 | F6 | High | 4 |
| FR10 | US10 | F7.1–F7.4 | High | 4 |
| FR11 | US11 | F7.5 | High | 5 |
| FR12 | US12 | F4.3–F4.4 | High | 3 |
| FR13 | US13 | F4.7 | Medium | 4 |
| FR14 | US14 | F4.8 | Low | 4 |

Sprint 1 contains Prereq 1–6: sitemap, wireframes, data requirements, ER diagram, technology selection, and repository/development setup. The backlog snapshot marks Prereq 1 Done: Pending Approval, Prereq 2–6 Ongoing, and US1–US14 Not Yet Started; these are not independently verified current statuses. Use fixtures for Sprint 3 inquiry work until listing creation in Sprint 4; final cross-role status acceptance depends on US11 in Sprint 5.

## 5. Risk Controls from Activity 4

- **Listing freshness (risk 1):** Show last-updated timestamps, provide a simple availability toggle, and remind owners to reconfirm published listings each semester. Semester dates and reminder delivery require configuration. Automatic expiry is not a confirmed requirement.
- **Owner adoption (risk 2):** Provide direct onboarding/consultation and free access to the basic listing workflow.
- **Fake users/inquiries (risk 3):** Require email verification during registration, enforce roles, and give owners access to the history of inquiries received on their own listings. Broader access to student activity is not assumed.
- **Scope/team risks (risks 4–5):** Follow the prioritized backlog, use clear GitHub task ownership and modular code, and review asynchronously when schedules conflict.
- **Privacy/mobile/data/media risks (risks 6–9):** Enforce NFR1–NFR10, daily backups, secure database configuration, responsive layouts, and image validation/compression.
- **Expectations (risk 10):** Review activity guides regularly and record design decisions/artifacts for instructor/client review.

## 6. Proposed Implementation Details

These retain useful detail from the earlier draft. They are not additional stakeholder-approved requirements and do not change the backlog priorities above. Exact tools and limits need team confirmation.

- **Registration:** Full name, email, and password for both roles; contact number required for owners, optional for students; college/program optional for students. Reject invalid/duplicate emails. Proposed password minimum: 8 characters, with a letter and a number.
- **Verification:** Single-use hashed tokens, proposed 24-hour expiry, rate-limited resend. Unverified users can browse, log out, and complete verification; protected role actions remain blocked. Auth providers may manage tokens/credentials instead of application tables.
- **Sessions:** HTTP-only, Secure, SameSite=Lax cookies; proposed 7-day expiry. Errors do not reveal whether an email is registered.
- **Listing fields:** Title, property type (bedspace/room/apartment), address, description, amenities, house rules, photos, availability, coordinates, and last-updated date. Title, type, address, valid coordinates, and availability are required to publish; photo minimum is proposed below. Price period supports monthly/semester.
- **Prices:** Positive PHP amount when supplied; store integer centavos. Proposed default: price hidden until the owner opts in. Hidden/omitted prices do not block publishing. Visible prices require an amount. Only the owning owner may see private amounts in management views.
- **Price discovery:** Proposed price-range filters exclude hidden-price listings. Proposed optional price sorting puts hidden-price listings last, ordered by posting date, never by their private amounts. These semantics require team confirmation.
- **Photos:** Proposed 1–10 images per listing, JPEG/PNG/WebP only, at most 5 MB each. Validate type/content on the server and size on client/server, strip EXIF metadata, compress/resize, and lazy-load responsive images. Cover selection and photo ordering are proposed follow-ups.
- **Availability/removal:** Available/Full plus optional non-negative slot count. Owners may edit all their listing fields and photos. Confirm removal and archive the listing; archived/draft listings are excluded from all public/student discovery. A save-draft UI is a future option.
- **Pagination:** Proposed UI default 20 listings; API page size capped at 50. Paginate all lists, including inquiries, saved properties, and reminders.
- **Inquiries:** Non-empty question text or one-action interest; at most one Pending interest per student/listing. Proposed decision transitions are Pending to Accepted/Rejected, with correction back to Pending. Track read status separately; never imply an accepted inquiry reserves a room.
- **Saved Properties:** Idempotent save/unsave, unique student/listing pair, persistent across sessions. Exclude archived listings and keep each student’s bookmarks private.
- **Distance:** Proposed straight-line Haversine calculation from confirmed listing coordinates to a configured campus point, in approximate km. No routing/map subscription is assumed. Require coordinates for new publication; show an explicit unavailable reason for legacy records missing them. Confirm method and campus point before acceptance.
- **Server protection:** Zod or equivalent validation, parameterized ORM queries, plain-text descriptions, escaped output, and rate limits on login, registration, verification/resend, and inquiries. Keep secrets in environment variables, never source control.
- **Disclosure:** Use explicit response fields; exclude owner contacts for guests and hidden prices for all non-owners, including metadata/cached payloads. Invalidate public data when price visibility changes. Protect owner and student record access on every request.
- **Privacy:** Provide a clear notice and terms during registration; collect minimum personal data. Proposed account deletion is a follow-up with its own data-retention design, not an implemented compliance claim.
- **Performance/capacity:** Proposed read API p95 ≤ 500 ms, write API p95 ≤ 1 second excluding uploads, at least 500 concurrent users, and capacity for 1,000 listings/10,000 photos. Validate against chosen hosting limits before committing to these targets.
- **Reliability:** Daily backups are baseline NFR9. Proposed retention is at least 7 days and uptime at least 99% during the academic term. Verify plan capability and restore procedures.
- **Usability/accessibility:** Proposed first listing opened within 1 minute, core-flow task success ≥ 90%, SUS ≥ 70, WCAG 2.1 AA, labels/alt text, keyboard operation, readable contrast, and system font scaling. English first; Filipino/Hiligaynon is a future consideration.
- **Engineering:** Proposed strict TypeScript, lint/format checks, CI, reviewed pull requests on main, versioned database migrations, error logging without personal data, and basic analytics for views/inquiries/registrations.
- **Verification:** Unit validation/domain checks, API integration checks, browser E2E for all baseline flows, cross-browser/mobile checks, and moderated usability testing. Proposed service-layer coverage ≥ 70%; map baseline acceptance to FR1–FR14 and NFR1–NFR12 rather than relying only on coverage.

## 7. Proposed Follow-ups and Open Decisions

Password reset (single-use email link, proposed 1-hour expiry), sorting, full in-app message threads, email/push inquiry notifications, account deletion, photo ordering, and draft-saving UI are follow-ups outside US1–US14. Full map browsing, PWA installation, reviews/ratings, and additional owner verification are future options. They must not displace scheduled search, saved-listing, or distance stories.

Confirm the client platform/stack, campus point and distance method, private-price filtering/defaults, inquiry correction rules, owner-scoped history, semester dates/scheduler, verification provider, and backup plan before implementation acceptance. The supplied interviews focus on Miagao; broader campus coverage requires confirmation. See PRD §§11–14 and TRD §§5–6, 12–14 for design details and reconciliation decisions.
