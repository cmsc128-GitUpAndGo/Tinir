This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Project requirements

Before implementing or reviewing a feature, read the relevant sections of:

- [PRD](docs/PRD.md): product goals, roles, scope, user flows, backlog priorities, and reconciliation decisions.
- [TRD](docs/TRD.md): technical design, data model, API contracts, security, testing, and operational requirements.
- [Requirements](docs/REQUIREMENTS.md): canonical FR1–FR14 and NFR1–NFR12 identifiers and acceptance criteria.

Implement the applicable requirements end to end and identify the FR/NFR IDs covered by the change. Follow the linked GitHub issue's acceptance criteria and native blocking relationships; distinguish implementation progress from completed integration checks.

Preserve the documented scope and backlog priorities. Keep proposed follow-ups and open decisions separate from confirmed requirements. Explicit user instructions take precedence over these documents. When the documents conflict, use their recorded reconciliation decisions; if a material conflict remains, explain it and ask for clarification while continuing independent work.

The agreed architecture uses Expo and Expo Router for the client and Supabase Auth, PostgreSQL RPCs, Storage, and Edge Functions for the backend. Follow the TRD's current interfaces and authorization boundaries; do not introduce a separate Next.js server or replace the Expo client without an explicit architecture decision. Record agreed architecture changes in the affected documents.

## Commit attribution

When commits are requested, use the user's existing Git author configuration. Do not add `Co-authored-by:` trailers or any other AI/assistant co-author attribution to commit messages. Do not change Git author/committer identity or rewrite existing commits unless explicitly requested.

## Branch, PR, and issue conventions

Use descriptive, project-focused branch names and publication text, such as `feat/supabase-backend` and `Add local Supabase backend`.

- Never reference Codex, case-insensitively, or add other AI/assistant branding in branch names, commit messages, PR or issue titles/bodies/labels, or publication comments. Omit tool-name prefixes and generated-by signatures.
- Before creating a branch, PR, issue, or comment, check the name/title/body against this rule. These project conventions override conflicting skill or tool naming defaults.
- Split substantial changes into focused commits grouped by concern so database, client integration, tooling, tests, and documentation can be reviewed separately.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md
