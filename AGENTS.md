# AGENTS.md

## 1. Project Identity & Governance

This document governs all automated agents and software engineers working on **JNTUA Attendance**, a cross-platform mobile application built with **Expo SDK 54** and **React Native 0.81.5**. The app is a single-screen, single-file Expo application (`App.tsx`) that embeds the JNTUA-CEA student portal in a `WebView`, scrapes attendance data via injected JavaScript, and renders a native dashboard.

There is no Expo Router, no `app/` directory, and no navigation library. The entry point is registered via `"main": "expo/AppEntry.js"` in `package.json`, and the single component in `App.tsx` manages all UI and state through `useReducer`.

### Core Directives

- **SDK 54 Compatibility:** Expo SDK 54 is strictly mandatory. All added packages must be compatible with Expo SDK 54 and installed via `npx expo install`.
- **Code Minimalism:** Prefer direct, concise implementation over abstractions. If a 5-line implementation achieves the exact result of a complex pattern, use the 5-line implementation.
- **Strict Typing & Modularity:** TypeScript strict mode is enabled. Never use explicit or implicit `any` or unsafe casts (`as unknown as T`). Logic, styling, state management, and UI rendering must be cleanly decoupled.
- **Mandatory Lint Gate:** A task is **never** complete until `npm run lint` passes with zero errors.

---

## 2. Pinned Technical Stack

All work must strictly adhere to the project's installed configuration. The `package.json` is the source of truth.

### Framework & Runtime

| Component | Package | Version |
|-----------|---------|---------|
| Expo SDK | `expo` | `~54.0.35` |
| React Native | `react-native` | `0.81.5` |
| React | `react` / `react-dom` | `19.1.0` |
| TypeScript | `typescript` | `~5.9.2` |
| ESLint | `eslint` + `eslint-config-expo` | `^9.25.0` / `~10.0.0` |

### Actively Used Libraries

| Library | Version | Usage |
|---------|---------|-------|
| `react-native-webview` | `13.15.0` | Embedded portal WebView for scraping |
| `expo-updates` | `~29.0.19` | Over-the-air update management |
| `expo-file-system` | `~19.0.23` | Local persistence of scraped attendance data |
| `expo-constants` | `~18.0.13` | Execution environment detection |
| `expo-splash-screen` | `~31.0.13` | Splash screen lifecycle management |
| `expo-build-properties` | `~1.0.10` | Android build configuration (buildArchs, minification) |
| `react-native-web` | `~0.21.0` | Web rendering compatibility |

> **[Updated]** `expo-splash-screen`, `expo-build-properties`, and `react-native-web` are now documented in the pinned stack. These were present in `package.json` but previously omitted from AGENTS.md.
> **[Updated]** `expo-file-system` import uses the `/legacy` subpath (`expo-file-system/legacy`) since SDK 54 — see `utils/storage.ts:1`.

Do not remove an actively used package. Before every release, audit `package.json` against imports, Expo config/plugins, scripts, and build configuration. Remove unused third-party dependencies and their transitive-only direct declarations when they are not required by the project. Do not install packages merely because they are available in the Expo ecosystem.

### Native Build Configuration

- **Architecture:** `arm64-v8a` only. Never add `armeabi-v7a`, `x86`, or `x86_64` unless the user explicitly changes this project requirement.
- **Minification:** Enabled in release builds (`enableMinifyInReleaseBuilds: true`)
- **Resource shrinking:** Enabled in release builds (`enableShrinkResourcesInReleaseBuilds: true`)
- **Android package:** `com.chanikya501.JNTUAAttendance`
- **Permissions:** `INTERNET` (required for WebView portal access)
- **Edge-to-edge:** Enabled (`edgeToEdgeEnabled: true`)
- **Predictive back gesture:** Enabled (`predictiveBackGestureEnabled: true`)
- **React Compiler:** Enabled (`experiments.reactCompiler: true`)

> **[Updated]** `edgeToEdgeEnabled`, `predictiveBackGestureEnabled`, and `experiments.reactCompiler` are now documented. These `app.json` settings were present but not reflected in AGENTS.md.

---

## 3. Mandatory Lint Gate

A task is **incomplete** until the lint check passes.

### Execution Protocol

1. Write minimal, strictly-typed, modular code.
2. Run the gate command:
   ```bash
   npm run lint
   ```
3. If errors occur: identify root causes, fix the underlying code, and re-run.
4. **Prohibited:** Disabling ESLint rules, injecting `@ts-ignore` / `@ts-expect-error`, or modifying lint configuration to force a pass.
5. Optionally verify type correctness:
   ```bash
   npx tsc --noEmit
   ```
6. Start the app if no lint errors occur:
   ```bash
   npm run start
   ```
> **[Fixed]** Corrected indentation of the `npm run start` code block (was missing proper ```bash fencing).

---

## 4. Package & Dependency Rules

### 1. Prohibition of `@latest`

Never install packages with `npm install <package>@latest`. Newer versions frequently break Expo SDK 54 compatibility.

### 2. Standard Installation Method

Always use Expo's resolution utility:
```bash
npx expo install <package-name>
```

### 3. Dependency Pre-checks

Before introducing any new dependency:

- Verify compatibility with Expo SDK 54.
- Confirm the required logic cannot be implemented with existing packages or standard TypeScript.
- Avoid adding dependencies for trivial utility tasks.

### 4. Native Dependency Impact

Any new native module (e.g., a native code dependency) requires a fresh EAS build and cannot be shipped via OTA update. `expo-file-system` and all other Expo modules already present are bundled in the runtime and ship via standard OTA. Only changes that add new native code or modify native configs require `npm run build:preview` or `npm run build:production`.

> **[Fixed]** Corrected the trailing period after `expo-file-system` (`expo-file-system.` → `expo-file-system and all`).

---

## 5. Architectural & Code Quality Rules

### A. Modular Design & Strict Types

- All props, parameters, return types, and hook signatures must be fully typed.
- Keep logic, styling, state management, and UI rendering cleanly decoupled across modules:
  - `App.tsx` — UI rendering and WebView orchestration only.
  - `utils/automationScripts.ts` — scraping scripts and shared TypeScript interfaces.
  - `utils/storage.ts` — local persistence helpers.
  - `utils/updateManager.ts` — OTA update lifecycle management.
- Do not duplicate or mirror state. Derive calculated values directly during render (e.g., `overallPercentage`, `calculateCanSkip`).

### B. Minimalist Code Principles

- Do not create wrapper components, custom hooks, or utility abstractions for single-use operations.
- Implement strictly what is required. No commented-out code, no unused utilities, no speculative abstractions.
- Avoid `useEffect` for logic that can be handled in event handlers or derived during render.

### C. WebView Scraping Architecture

The app drives the JNTUA-CEA portal through a `WebView` and extracts data via `window.ReactNativeWebView.postMessage`. The scraping flow is URL-driven:

1. **`studenthome.php`** — `autoSubmitFirstSemesterScript` extracts student info (`STUDENT_INFO`), submits the subjects form.
2. **`studentsubjects.php`** — `selectSubjectByIndexScript(index)` finds subject rows, reports `SUBJECT_COUNT`, clicks the row at `currentIndex`. Posts `SCRAPING_COMPLETE` when `currentIndex` exceeds the row count.
3. **`studentsubatt.php`** — `parseDetailedAttendanceAndGoHomeScript` parses the attendance table, posts `ATTENDANCE_ITEM`, then navigates back to the home page.

JavaScript is injected via `webViewRef.current?.injectJavaScript()` inside the `onNavigationStateChange` callback. Scripts must always end with `true;` to keep the WebView bridge alive.

### D. State Management

- All dashboard state lives in a single `useReducer` with a typed `AppState` and discriminated-union `AppAction`.
- The full `AppState` includes: `webViewKey`, `isLoggedIn`, `studentInfo`, `currentIndex`, `totalSubjects`, `fetchedIndices`, `subjectsData`, `isScrapingFinished`, `selectedSubject`, `hasPreviousResult`, `previousResult`, `isSelectionError`, `isSplashDismissed`, and `gatewayError`.
- `RESET` returns to `initialState` while preserving `hasPreviousResult`, `previousResult`, `isSplashDismissed`, and bumping `webViewKey` (via `preserveSession`) — so the "Previous Attendance" button persists after Back is pressed and the WebView re-mounts fresh.
- `HYDRATE_PREVIOUS_RESULT` is a single atomic dispatch that restores the dashboard with zero re-scraping and no WebView re-authentication.

> **[Updated]** `isSelectionError`, `isSplashDismissed`, and `gatewayError` state fields are now documented. The `preserveSession` helper (which preserves these fields on `RESET`, `CLEAR_SELECTION_ERROR`, and `CLEAR_GATEWAY_ERROR`) is now documented. The `CLEAR_GATEWAY_ERROR` and `SET_GATEWAY_ERROR` actions are documented.

### E. Persistence Model

- Storage backend: `expo-file-system` (`FileSystem.documentDirectory` via the `/legacy` subpath).
- Data format: JSON file at `previous_attendance_result.json`.
- Only `studentInfo` and `subjectsData` are persisted; all aggregates are derived at render.
- Persist once per unique result using a `useRef` signature guard (`name|subjectsCount|totalClasses|present`).
- `loadPreviousResult()` validates the persisted shape and returns `null` on corruption — never throws.

> **[Updated]** Documented the `expo-file-system/legacy` import path used in `utils/storage.ts:1`.

---

## 6. Error Handling & Mobile UX

### A. Stall Detection

When the app is logged in but scraping has not finished, an interval checks `lastActivityRef` every second. If no `postMessage` arrives within `STALL_TIMEOUT_MS` (15 seconds), `SET_SELECTION_ERROR` is dispatched, displaying a "Couldn't load subjects right now" overlay.

### B. Gateway Error Handling

- HTTP 502 responses from the WebView trigger `SET_GATEWAY_ERROR`.
- When `gatewayError` is true, an opaque overlay with `CrabScene` animation displays "Main attendance website is not working" with a "Try again" button that dispatches `RESET`.
- Any subsequent `onLoadStart` call dispatches `CLEAR_GATEWAY_ERROR` to dismiss the overlay once the page loads normally.

### C. Back Handler (Android)

- **Hardware back press:** If a modal (subject log) is open, closes it. If the dashboard is shown (`isScrapingFinished && isLoggedIn`), dispatches `RESET` to return to the login flow. If a selection error is shown, dismisses it. Otherwise, a double-tap within 2 seconds exits the app via `BackHandler.exitApp()`, with a "Press back again to exit" toast.
- **Web popstate:** On web, a `popstate` listener intercepts back-button navigation, routes it through the same `handleBackConsumed` logic, and re-pushes the history state to prevent leaving the app.

### D. Splash Screen Management

- `SplashScreen.preventAutoHideAsync()` is called once (guarded by a ref) before first render.
- The splash screen is hidden (`SplashScreen.hideAsync()`) on the first `onLoadStart` callback, gated by `isSplashDismissed` state so it only hides once.

### E. Animated Loader (CrabScene)

During the "Authenticating session…" and syncing phases, an animated crab scene (`CrabScene`) renders using pure `Animated` API (no external dependencies). The animation includes walking, hopping, leg movement, blinking, and a sparkle ring effect.

---

## 7. OTA Update Workflow

### Channels

| Channel | EAS Build Profile | Purpose |
|---------|-------------------|---------|
| `staging` | `preview` | Validate updates before reaching end users |
| `production` | `production` | Live updates for all users |

> **[Updated]** The `preview` and `production` EAS build profiles use `appVersionSource: "remote"` (from `eas.json` → `cli.appVersionSource`), meaning the version is sourced from the Expo servers during build, enabling `autoIncrement: true` on the production profile.

### Update Behaviour

- `app.json` → `updates.checkAutomatically: "NEVER"` — update checks are controlled explicitly by `utils/updateManager.ts`; do not create a second automatic update-check path.
- `runtimeVersion.policy: "appVersion"` — the `version` field in `app.json` determines update compatibility. Bumping the version forces a fresh native build.
- `shouldCheckOnMount()` in `utils/updateManager.ts` returns `false` in `__DEV__` and in Expo Go (`StoreClient`); updates only apply to production/staging builds.
- A non-blocking banner displays "Checking for updates…" or "Applying update…" while the update lifecycle runs.
- The `useUpdateManager` hook implements a 30-second timeout (`CHECK_TIMEOUT_MS`) on update checks — if a check exceeds this, the status falls back to `"unknown"` to avoid blocking the user indefinitely.

> **[Updated]** Documented the 30-second timeout guard in `useUpdateManager()`.

### Publishing Runbook

```bash
# 1. Authenticate with Expo (one-time)
eas-cli login

# 2. Publish a JS-only update to staging
npm run update:staging

# 3. Validate on a staging build, then promote to production
npm run promote:production

# Or publish directly to production
npm run update:production
```

### Native Build Runbook

```bash
# Staging (APK, staging channel)
npm run build:preview

# Production (APK, production channel, auto-incremented version)
npm run build:production
```

Any change to native code, `app.json` native config, or new native dependencies requires a fresh build. JS-only changes to `App.tsx`, `utils/*.ts` ship via `eas update`.

---

## 8. Execution Workflow

```
[1. Understand Context] → [2. Minimal Implementation] → [3. Enforce Strict Types]
   → [4. Execute Lint Gate] → [5. Complete] 
```

1. **Inspect** existing files and system context before editing.
2. **Minimal Change** — apply the smallest safe change required.
3. **Verify** strict typing, modular separation, and platform stability (Android).
4. **Lint Check** — run `npm run lint` and resolve all flagged errors.
5. **App Start** — run `npm run start` and check for any runtime errors by running the app and resolving any errors that occur.

> **[Fixed]** Corrected "resolve if anny errors occur" → "resolving any errors that occur".

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

When the user types `/graphify`, use the installed graphify skill or instructions before doing anything else.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- Dirty graphify-out/ files are expected after hooks or incremental updates; dirty graph files are not a reason to skip graphify. Only skip graphify if the task is about stale or incorrect graph output, or the user explicitly says not to use it.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).If graphify tool doesn't exist give suggestion to user to add graphify.

---

## 9. Final Production Gate — Mandatory

**No agent may declare a task complete, production-ready, or release-ready until every applicable gate below passes. A failure is a hard stop. Do not hide, suppress, bypass, or downgrade a failure.**

### A. Dependency Hygiene

Before building:

```bash
npm ci
npm ls --depth=0
```

Audit the dependency graph and source usage.

Rules:

1. Every direct runtime dependency must have a verified purpose in the application, Expo configuration, build configuration, or required tooling.
2. Remove unused direct dependencies from `package.json`.
3. Do not add a package when the same requirement can be implemented with:
   - React Native/React APIs already present;
   - Expo SDK 54 APIs already installed;
   - standard TypeScript/JavaScript;
   - an existing project dependency.
4. Do not install the entire Expo ecosystem "just in case".
5. Do not retain packages solely because they were generated by an earlier template.
6. After dependency changes, run:
   ```bash
   npm install
   npm ci
   ```
   and commit the synchronized `package-lock.json`.
7. Never manually edit `package-lock.json` to silence dependency errors.
8. If `npm ci` reports package/lockfile drift, fix the dependency manifest and regenerate the lockfile before any EAS build.

### B. Architecture Gate

Android production artifacts MUST contain only:

```text
arm64-v8a
```

The project must not intentionally build:

```text
armeabi-v7a
x86
x86_64
```

Verify the effective Expo/native configuration before release. If a dependency or configuration attempts to reintroduce another ABI, stop and fix it rather than accepting a larger multi-ABI artifact.

### C. Expo Go / Development Gate

Expo Go is not the production validation environment.

Use:

```bash
npx expo start --dev-client
```

for native-development validation when a development build is available.

The production artifact must be tested as a standalone EAS build.

`EAS_BUILD_NO_EXPO_GO_WARNING=true` may suppress the CLI warning, but **it must never be used to conceal an actual Expo Go/native-runtime incompatibility**.

### D. Static Quality Gate

Run all of:

```bash
npm run lint
npx tsc --noEmit
npx expo-doctor
```

All must finish successfully.

Prohibited:

```text
@ts-ignore
@ts-expect-error
eslint-disable
eslint-disable-next-line
weakening tsconfig
weakening ESLint rules
removing tests/checks merely to make the gate pass
```

If a warning indicates a genuine dependency/configuration problem, fix the cause.

### E. Configuration Gate

Verify:

- Expo SDK remains 54.
- React Native remains compatible with SDK 54.
- Android package identifier is unchanged unless intentionally migrated.
- `android.buildArchs` is `arm64-v8a` only.
- Release minification remains enabled.
- Release resource shrinking remains enabled.
- Required Expo config plugins are present.
- `runtimeVersion` remains compatible with the OTA strategy.
- EAS production channel is `production`.
- Staging/preview channel remains separate from production.
- Secrets are not hard-coded into source, README, or configuration committed to Git.
- `.env` files containing secrets are never committed.

### F. OTA Gate

There must be exactly one deliberate update-check strategy.

Current policy:

```text
updates.checkAutomatically = NEVER
        ↓
utils/updateManager.ts
        ↓
explicit check/fetch/reload
```

Do not reintroduce a second automatic check without updating this document and the architecture.

Remember:

```text
JS/TS/UI-only change
    → EAS Update may be sufficient

Native dependency
Native configuration
AndroidManifest/native code
expo-build-properties
ABI/build configuration
    → new EAS build required
```

Never tell the user that an OTA update can change native code or native dependencies.

### G. WebView Production Gate

Because the application depends on a remote portal:

1. Confirm the portal URL is HTTPS.
2. Do not change the production portal URL to an untrusted HTTP endpoint.
3. Keep injected scripts scoped to the expected portal flow.
4. Validate WebView bridge messages at runtime; TypeScript casts are not runtime validation.
5. Do not log credentials, session cookies, or sensitive scraped data.
6. Do not persist portal passwords.
7. Treat DOM selectors as an external compatibility boundary.
8. Test login → subject discovery → subject iteration → attendance parsing → dashboard rendering on a real Android device.

### H. Persistence Gate

Verify that:

- persisted attendance data is validated before use;
- corrupted data fails safely;
- only required attendance data is persisted;
- credentials are not persisted;
- derived aggregate values are recalculated rather than stored redundantly.

### I. Production Build Gate

Run:

```bash
npm ci
npm run lint
npx tsc --noEmit
npx expo-doctor
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:preview
```

Install and test the preview artifact on a physical ARM64 Android device.

Only after preview validation succeeds:

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:production
```

For Google Play distribution, use an Android App Bundle (`.aab`) rather than an APK unless direct APK distribution is intentional.

### J. Final Agent Declaration

An agent may state:

```text
Production-ready
```

ONLY when all applicable gates pass.

The final report must contain:

```text
Dependency audit: PASS/FAIL
npm ci: PASS/FAIL
Lint: PASS/FAIL
TypeScript: PASS/FAIL
Expo Doctor: PASS/FAIL
ARM64-only configuration: PASS/FAIL
Expo Go production warning: ACKNOWLEDGED/SUPPRESSED
OTA configuration: PASS/FAIL
WebView production checks: PASS/FAIL
Preview build: PASS/FAIL
Production build: PASS/FAIL
```

If any required item is `FAIL`, the agent must report the failure and must not claim release readiness.

### K. Change Discipline

For every task:

```text
Inspect → Plan → Minimal Change → Dependency Audit
→ Lint → Typecheck → Expo Doctor → Build Validation
→ Final Gate → Report
```

Do not make unrelated refactors while fixing a production issue.

Do not declare success because code "looks correct".

A successful command is evidence only for that command; it is not evidence that unrelated gates passed.
