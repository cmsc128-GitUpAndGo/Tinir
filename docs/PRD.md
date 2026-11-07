# Tinir — Product Requirements Document (PRD)

| | |
|---|---|
| **Product** | Tinir (working title) |
| **Document** | Product Requirements Document |
| **Version** | 0.3 (Supabase backend decision) |
| **Date** | 2026-11-07 |
| **Status** | Product baseline aligned to source activities; Expo + local Supabase backend selected by the user; remaining UI/hosted acceptance is tracked separately |
| **Team** | Arellano, Junel · Blancada, Eusef Karl · De Asis, Dejel Cyrus · Placer, Josef Magloire · Vincoy, Claire Dane |

---

## 1. Overview

Tinir is an accommodation-finder platform for the University of the Philippines Visayas (UPV) community. It connects **UPV students** looking for rentals with **property owners** who offer bedspaces, rooms, and apartments. Students get one place to find, compare, and ask about accommodations. Owners get an easy way to publish and maintain their listings.

## 2. Problem Statement

Finding suitable, affordable accommodation for the semester is a major concern for UPV students:

- **Limited dormitory slots.** Many students apply to university dormitories because they are affordable, but not every applicant gets in.
- **Preference for off-campus housing.** Some students choose off-campus housing because the house rules and living arrangements are more flexible.
- **Fragmented search.** Students often have to search several platforms (social media groups, word of mouth, posters), contact owners one by one, compare prices and amenities by hand, and check availability themselves.
- **Owner-side friction.** Property owners need simple ways to advertise vacancies, talk to prospective tenants, and keep listing information accurate.

The supplied interviews support a **centralized, locally focused** accommodation platform. The student described weeks of searching, stale listings, a PHP 1,500–2,000 monthly rent budget, and the importance of distance, house rules, and utilities. The owner welcomed listing and vacancy tools but preferred discussing prices and terms face to face. ACT 2 records validation by Anne Nonato (property owner representative) and James Ivan Villar (student representative), including a requested change allowing owners to hide prices.

The personas below are illustrative, not transcripts or verified identities of the interview participants.

## 3. Goals and Non-Goals

### 3.1 Goals

1. **G1: Centralize discovery.** Collect bedspace, room, and apartment listings near UPV in one place.
2. **G2: Improve information access.** Show location, amenities, availability, house rules, and owner-disclosed prices consistently.
3. **G3: Simplify communication.** Let students contact owners or express interest from inside the app.
4. **G4: Empower owners.** Give property owners an easy way to publish, update, and remove listings.
5. **G5: Low barrier to entry.** Let anyone browse as a guest without creating an account.

### 3.2 Non-Goals (for the initial release)

- Online rent payment, deposits, or escrow.
- Formal lease or contract generation and e-signing.
- Tenant screening or background checks.
- Booking or reservation guarantees. Inquiries do not confirm a slot.
- Coverage beyond the UPV area (for example, other universities or cities).
- Roommate matching.
- In-app conversation threads and viewing/reservation scheduling. These arose in interviews but are outside the supplied core backlog. An accepted inquiry does not reserve a room.

## 4. Target Users and Personas

### 4.1 Student / Prospective Tenant

> **"Bea," 2nd-year UPV Miagao student.** She didn't get a dorm slot this semester. She has a limited monthly budget, wants to walk to campus, and needs Wi-Fi and a safe place. Today she scrolls through several Facebook groups and messages owners one at a time, and many never reply or their listing is already taken.

**Needs:** browse many options fast; see price, location, amenities, and availability at a glance; contact owners easily; trust that a listing is current.

### 4.2 Property Owner

> **"Mang Rudy," boarding house owner near campus.** He has 3 vacant bedspaces at the start of the semester. He posts on social media and tapes notices to posts, and he answers the same questions about price and rules over and over.

**Needs:** post a vacancy quickly with photos; update availability when slots fill; receive inquiries in one place.

### 4.3 Guest

Anyone (a student, a parent, an incoming freshman) who wants to look at available accommodations without signing up.

## 5. User Roles and Permissions

| Capability | Guest | Student | Property Owner |
|---|:-:|:-:|:-:|
| Browse listings | ✅ | ✅ | ✅ |
| View basic property information | ✅ | ✅ | ✅ |
| View full listing details | ⚠️ No owner contacts | ✅ | ✅ |
| View owner contact details | ❌ | ✅ | ✅ |
| Save listings / calculate campus distance | ❌ | ✅ | ❌ |
| Inquire about a property / express interest | ❌ (prompted to sign up) | ✅ | ❌ |
| Add property listing | ❌ | ❌ | ✅ |
| Edit / update availability / remove own listings | ❌ | ❌ | ✅ (own only) |
| View inquiries on own listings | ❌ | ❌ | ✅ |

Owner contact details are visible only to logged-in users (ACT 2 NFR8). A hidden price is withheld from guests and other users regardless of login; only the listing owner can view it in management screens. Activated student/owner permissions require email verification, following Activity 4 risk 3.

## 6. Features and Requirements

Use the backlog’s **High / Medium / Low** priorities and **Sprint 1–5** schedule for committed stories. A Low-priority story remains in scope when scheduled. **P1** below means a proposed follow-up outside that backlog; **P2** means a possible future enhancement. Activity 4 mitigations are identified separately. Canonical FR1–FR14 and NFR1–NFR12 are defined in REQUIREMENTS.md.

### 6.1 General Features

#### F1. Explore as Guest (backlog scope)

| ID | Requirement |
|---|---|
| F1.1 | A user can view available accommodation listings without creating an account. |
| F1.2 | A guest can view basic property information: title, type (bedspace/room/apartment), owner-disclosed price or "Contact owner for price", general location, and cover photo. Owner contact details are omitted. |
| F1.3 | When a guest tries a restricted action (for example, inquiring), the app prompts them to log in or sign up. |

#### F2. Account Registration (backlog scope)

| ID | Requirement |
|---|---|
| F2.1 | A user can sign up as either a **Student** or a **Property Owner**. |
| F2.2 | The registration form asks for the information required by the selected account type. |
| F2.3 | **Student fields (proposed):** full name, email, password, contact number (optional), college/program (optional). |
| F2.4 | **Owner fields (proposed):** full name, email, password, contact number (required). |
| F2.5 | The system validates input (email format, password strength, required fields) and rejects duplicate emails. |
| F2.6 | Require email verification before activating protected student/owner actions (Activity 4 risk 3). Unverified accounts may browse and request another verification email. |

#### F3. Login (backlog scope)

| ID | Requirement |
|---|---|
| F3.1 | A registered user can log in with their email and password. |
| F3.2 | After login, the user can access only the features of their role. |
| F3.3 | A user can log out. |
| F3.4 | (P1) A user can reset a forgotten password by email. |

### 6.2 Student Features

#### F4. Browse Accommodation Listings (backlog scope)

| ID | Requirement |
|---|---|
| F4.1 | A student can view listings of bedspaces, rooms, and apartments. |
| F4.2 | A student can open a listing to see its owner-disclosed rental price (or "Contact owner for price"), location, description, house rules, amenities, photos, availability, and last-updated date. |
| F4.3 | A student can filter listings by property type, price range, and amenities (FR12 / US12, High, Sprint 3). Selected handling: a price-range filter excludes hidden-price listings to prevent disclosure through filtering. |
| F4.4 | A student can search listings by keyword in the title, address, or area (FR12 / US12, High, Sprint 3). |
| F4.5 | (P1) A student can sort listings by price or by date posted. |
| F4.6 | (P2) A student can view listings on a map. |
| F4.7 | A student can save/unsave listings and revisit them on a Saved Properties page (FR13 / US13, Medium, Sprint 4). |
| F4.8 | A student can calculate accommodation-to-campus distance and see a distance indicator (FR14 / US14, Low, Sprint 4). Selected method: approximate straight-line distance, clearly labeled; not a travel-time or road-route estimate. |

#### F5. Inquire About a Property (backlog scope)

| ID | Requirement |
|---|---|
| F5.1 | A student can contact the property owner to ask about availability, rental terms, or other details. |
| F5.2 | A student can **express interest** in a listing with one action. The interest appears in the owner inbox. Email/push notifications are a proposed follow-up. |
| F5.3 | A student can view sent inquiries with Pending, Accepted, or Rejected status (US8). Accepted means the owner is willing to pursue the inquiry; it does not guarantee a booking or slot. |
| F5.4 | (P1, outside core backlog) The owner and student can continue the conversation in an in-app message thread. |

### 6.3 Property-Owner Features

#### F6. Add Property Listing (backlog scope)

| ID | Requirement |
|---|---|
| F6.1 | An owner can create a listing with title, property type, location/address, rental price, description, and amenities. |
| F6.2 | An owner can upload property photos (proposed: 1–10 images per listing). |
| F6.3 | An owner can set availability (for example, number of available slots, or Available/Full). |
| F6.4 | The system validates required fields before publishing. |
| F6.5 | An owner can choose whether a rental price is visible to other users, and change that choice later (ACT 2 validation amendment to FR6). Hidden prices are omitted from public/student API responses. |

#### F7. Manage Property Listings (backlog scope)

| ID | Requirement |
|---|---|
| F7.1 | An owner can view all of their listings in a dashboard. |
| F7.2 | An owner can edit any field of an existing listing, including photos. |
| F7.3 | An owner can update availability. |
| F7.4 | An owner can remove (unpublish or delete) a listing. |
| F7.5 | An owner can view inquiries and expressions of interest received for each listing and set Pending, Accepted, or Rejected status (FR11 / US11, High, Sprint 5). |
| F7.6 | Listings show update timestamps; owners receive a reminder to reconfirm each semester and can toggle availability easily (Activity 4 risk 1). |
| F7.7 | An owner can see the history/status of inquiries received on their own listings; this does not expose a student’s inquiries to other owners (proposed privacy boundary for Activity 4 risk 3). |

## 7. Key User Flows

1. **Guest browse:** Open app → Browse listings → View listing → (tries to inquire) → Prompted to sign up/log in.
2. **Student sign-up and inquiry:** Sign up as Student → Verify email → Browse/search/filter → Open listing → Send inquiry / Express interest → View Pending/Accepted/Rejected status.
3. **Owner onboarding and posting:** Sign up as Owner → Verify email → Dashboard → Add listing (details + photos + price visibility) → Publish.
4. **Owner maintenance:** Log in → Dashboard → Accept/reject inquiries → Update availability / Edit / Remove listing.
5. **Student shortlist:** Open listing → Save → Revisit Saved Properties → View approximate campus distance.

## 8. Non-Functional Requirements (Product-Level)

Source NFR1–NFR12 are canonical in REQUIREMENTS.md. Additional usability/accessibility and language targets below remain proposals.

| Area | Requirement |
|---|---|
| Usability | Usable on mobile phones first, since most students search on their phones. A first-time user can find and open a listing within 1 minute. |
| Performance | The listings page loads within 3 seconds on a mobile 4G connection (NFR1). |
| Accessibility | Readable contrast, labeled form fields, and support for system font scaling. |
| Privacy | Personal contact details are shown only as defined in §5. Complies with the Philippine Data Privacy Act of 2012 (RA 10173). |
| Trust | Listings show a "last updated" date; semester reminders prompt owners to reconfirm availability. |
| Consistency and feedback | Consistent navigation, readable text, labeled controls, and clear feedback for failed operations, missing fields, and invalid data (NFR11–NFR12). |
| Security and reliability | HTTPS, hashed passwords, server-side role/ownership checks and validation, daily database backups, and current Chrome/Safari/Firefox/Edge support (NFR3–NFR10). |
| Language | English UI for the first release. Filipino/Hiligaynon support to be considered. |

## 9. Success Metrics (Proposed, not stakeholder-approved targets)

| Metric | Target (initial, to be validated) |
|---|---|
| Active listings at launch | ≥ 20 listings from ≥ 10 owners |
| Student registrations (first semester) | ≥ 100 |
| Inquiry rate | ≥ 20% of students who view a listing send an inquiry or express interest |
| Listing freshness | ≥ 80% of active listings updated within the last 30 days |
| Usability test task success | ≥ 90% of testers complete the core flows without help |
| User satisfaction (SUS score) | ≥ 70 |

## 10. Assumptions and Constraints

- Most target users have a smartphone and internet access.
- Property owners are willing to create accounts and keep listings up to date.
- The project is built by a 5-person student team within an academic term, so scope must stay limited.
- The initial release has no budget for paid third-party services beyond free tiers.

## 11. Open Questions

1. Which hosted Supabase project/region/plan and production SMTP/redirect settings will be used? The selected client is Expo/React Native with Expo web support; the backend is Supabase Auth/Postgres/Storage/RPCs/Edge Functions. No separate Next.js server or hosted deployment is part of local setup.
2. Which precise UPV campus point should distance calculations use? Interviews and adoption risks focus on Miagao; confirm any Iloilo City coverage before expanding.
3. What exact campus reference coordinates should be configured? The user selected labeled approximate straight-line Haversine distance; routed travel distance/time remains outside the baseline.
4. Do owners need proof-of-ownership checks beyond email verification, and should students require `@up.edu.ph` addresses?
5. Should listings expire if owners do not respond to semester reminders? Reminders are in the risk plan; automatic expiry is not.
6. Which remaining usability, capacity, retention, and operational targets will be adopted for deployment? These remain proposals; local backend checks do not prove production or screen acceptance.

## 12. Delivery Plan (Supplied Product Backlog)

| Sprint | Scope | Backlog priority |
|---|---|---|
| 1 | Prereq 1–6: sitemap, wireframes, data requirements, ER diagram, stack selection, repository/environment setup | High |
| 2 | US1 guest browse; US2 registration; US3 login/logout; US4 role access | High, except US4 Medium |
| 3 | US5 listing details; US6 guest inquiry prompt; US7 send inquiries; US8 inquiry status; US12 search/filters | US5/US7/US12 High; US6/US8 Medium |
| 4 | US9 create listings; US10 manage listings; US13 saved properties; US14 campus distance | US9/US10 High; US13 Medium; US14 Low |
| 5 | US11 owner inquiry inbox and status updates | High |

Interviews and ACT 2 validation are documented in the supplied files. The supplied backlog marks Prereq 1 "Done: Pending Approval", Prereq 2–6 "Ongoing", and US1–US14 "Not Yet Started"; these are snapshot statuses, not independently verified current progress. Sprint 3 inquiry work can use fixtures until listing creation arrives in Sprint 4; final inquiry-status acceptance requires US11 in Sprint 5. Email verification and semester reminders must be included as Activity 4 mitigation tasks during planning; the supplied backlog does not assign them a sprint.

Proposed follow-ups outside US1–US14 include password reset, sorting, email notifications, account deletion, and in-app conversation threads. Future options include a full map browser, PWA installation, reviews/ratings, and additional owner verification. These do not displace scheduled stories.

## 13. Related Documents and Sources

- [Technical Requirements Document (TRD)](./TRD.md)
- [Functional and Non-Functional Requirements](./REQUIREMENTS.md): canonical IDs, acceptance criteria, and story mapping.
- `CMSC_128_Activity.pdf`, pp. 1–3: student/owner interviews and original proposal.
- `ACT 2.pdf`, p. 1: FR1–FR14 and NFR1–NFR12; p. 2: stakeholder validation and optional-price amendment.
- `ACT 3.pdf`, p. 1: link to the product-backlog spreadsheet. The linked live sheet was not verified for this revision.
- `TINIR_ProductBacklog - Product_Backlog.pdf`, p. 1: prerequisites, US1–US14, priorities, dependencies, and sprints.
- `act 4.pdf`, pp. 1–3: ten project/product/business risks and mitigations.

Source PDFs were supplied from `/home/dejel/Documents/UPV/TINIR-128/`. This revision uses those local snapshots and does not claim that the revised documents themselves have been signed off.

## 14. Reconciliation Decisions

- **Price visibility:** Apply ACT 2’s validation amendment to the earlier requirement and backlog wording. An owner may keep the stored price private; hiding it must not prevent publishing. The user selected default-hidden prices and exclusion of hidden-price records from price-range filters for backend implementation. These are recorded implementation decisions, not quotes from the stakeholder validation report.
- **Inquiry status:** Use the backlog’s Pending/Accepted/Rejected workflow instead of the earlier draft’s New/Read/Replied/Closed. Selected transitions: Pending to Accepted or Rejected; an owner may return a decision to Pending to correct it. Read timestamps are separate metadata. An accepted inquiry does not reserve accommodation.
- **Priorities:** Preserve scheduled US12–US14, including Low-priority distance calculation. They are not deferred to a future release.
- **Risk controls:** Require email verification and semester reminders as Activity 4 mitigations. Limit owner access to inquiry history on their own listings; broader student profiling would require separate agreement.
- **Research requests versus delivery scope:** Interviews mention reservations, viewing appointments, distance filters, and chat. Only requirements carried into ACT 2/backlog or explicit risk mitigations are included in the baseline. Full chat and scheduling remain proposed follow-ups.

## 15. Selected Backend Implementation

On 2026-11-07 the user approved a Supabase-only, local-first backend supporting FR1–FR14, retaining the existing Expo client. Supabase manages credentials/verification and PostgreSQL access; private tables are exposed only through guarded RPC operations, with an Edge Function validating and processing photos. The user also selected hidden-price defaults/filter exclusion, corrections through Pending, and approximate straight-line distance. Real campus reference points and semester dates remain configurable rather than fabricated. See [TRD](TRD.md) and [Backend setup](BACKEND.md).

This task adds backend services and a minimal verification callback, not all feature screens. The original user-story/NFR issues remain open until their complete acceptance criteria are met. Architecture/schema/setup work links to existing issues #4–#7; UI, hosted services, actual email delivery, backups, performance, and device acceptance retain their separate verification boundaries.
