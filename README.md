# JNTUA Attendance

A React Native (Expo SDK 54) mobile application that lets students of
JNTUACEA view and track their academic attendance from the JNTUA-CEA
Student Portal (`jntuaceastudents.classattendance.in`). The app embeds a
WebView, authenticates against the portal, scrapes subject-wise
attendance data, and renders a native dashboard with per-subject
breakdowns and shortage warnings for attendance below the 75% threshold.

------------------------------------------------------------------------

## Table of Contents

-   [Project Idea](#project-idea)
-   [How It Works](#how-it-works)
-   [Architecture](#architecture)
-   [Project Structure](#project-structure)
-   [Tech Stack](#tech-stack)
-   [Getting Started](#getting-started)
-   [Usage Guide](#usage-guide)
-   [Data Pipeline](#data-pipeline)
-   [The 75% Rule Logic](#the-75-rule-logic)
-   [Previous Attendance Persistence](#previous-attendance-persistence)
-   [Mobile UX Features](#mobile-ux-features)
-   [Error Handling](#error-handling)
-   [OTA Updates (EAS Update)](#ota-updates-eas-update)
-   [Troubleshooting](#troubleshooting)
-   [Contributing](#contributing)
-   [License](#license)

------------------------------------------------------------------------

## Project Idea

University portals are often slow, clunky, and not designed for mobile.
Students frequently need to check whether their attendance is on track
--- especially the **75% minimum** required to sit for semester exams.

This app removes that friction by:

1.  **Reusing the existing login session** --- the student logs in
    through the official portal inside the app, so no credentials are
    stored locally.
2.  **Automating the data retrieval** --- the app drives the portal
    through a WebView and extracts attendance programmatically.
3.  **Presenting a clear dashboard** --- instead of a jumble of HTML
    tables, the student sees a summary card, per-subject cards with
    percentage badges, skip-capacity indicators, and immediate shortage
    warnings.

The core idea is a thin, well-structured wrapper around an existing web
service that turns a mediocre web UX into a purpose-built mobile one ---
without duplicating any backend logic.

------------------------------------------------------------------------

## How It Works

The app does **not** use a REST API or scrape from a server. Instead it
runs everything client-side inside a `react-native-webview`:

1.  The WebView loads the portal's root URL
    (`https://jntuaceastudents.classattendance.in/`).
2.  The user logs in normally through the embedded portal pages.
3.  Once on the student home page (`studenthome.php`), the app injects
    JavaScript that:
    -   reads the student's profile (name, admission number, class),
    -   posts that data back to React Native via `postMessage`,
    -   submits the "Subjects" form automatically.
4.  The app cycles through each subject:
    -   a script selects a subject row by index,
    -   a script parses the detailed attendance table (date, time,
        status),
    -   a script returns to the home page for the next subject.
5.  When all subjects are collected, the WebView is hidden and the
    dashboard is rendered from the aggregated in-memory data.

All scraping logic lives in `utils/automationScripts.ts` as
self-contained JavaScript string templates that are injected into the
page via `webViewRef.current.injectJavaScript()`.

------------------------------------------------------------------------

## Architecture

The application is a single-file Expo app with a clear separation of
concerns across three utility modules:

    ┌─────────────────────────────────────────────────────────────┐
    │                         App.tsx                              │
    │  - UI (login overlay, loader, dashboard, modal)             │
    │  - State management (useReducer)                            │
    │  - WebView orchestration (navigation + message routing)     │
    │  - Aggregation math (derived at render)                     │
    │  - Persistence effects (load on mount, save on completion)  │
    │  - Error handling (stall detection, gateway errors)         │
    │  - Back handler (Android hardware + web popstate)           │
    │  - Splash screen lifecycle management                          │
    └───────────────────────┬─────────────────────────────────────┘
                            │ injectJavaScript / postMessage
    ┌───────────────────────┼─────────────────────────────────────┐
    │                 utils/automationScripts.ts                  │
    │  - Self-contained JS injection scripts                      │
    │  - Shared TypeScript interfaces (StudentInfo,              │
    │    SubjectAttendanceData, AttendanceRecord)                │
    │  - Global Window type declaration for ReactNativeWebView   │
    └───────────────────────┼─────────────────────────────────────┘
                            │ save / load JSON to documentDirectory
    ┌───────────────────────┼─────────────────────────────────────┐
    │                   utils/storage.ts                          │
    │  - savePreviousResult                                       │
    │  - loadPreviousResult (shape-validated, null on error)      │
    │  - clearPreviousResult                                      │
    └───────────────────────┼─────────────────────────────────────┐
                            │ checkForUpdate, fetchUpdate, reload
    ┌───────────────────────┘
    │                   utils/updateManager.ts                    │
    │  - UpdateStatus union type                                  │
    │  - UpdateManager interface                                  │
    │  - shouldCheckOnMount() guard                               │
    │  - useUpdateManager() hook wrapping expo-updates           │
    └─────────────────────────────────────────────────────────────┘

### Key design decisions

-   **`useReducer` for state** --- all dashboard state (student info,
    subject list, progress, scraping status, selected subject, persisted
    result, selection errors, gateway errors, splash state) is
    consolidated in a single reducer. A `RESET` action returns to
    `initialState` while preserving `hasPreviousResult` and
    `previousResult` (the persisted result is not cleared by Back), and
    bumps `webViewKey` to re-mount the WebView --- the cleanest way to
    "log out" without storing credentials.
-   **Memoized handlers** --- the WebView's `onNavigationStateChange`,
    `onMessage`, and the reset/previous-result handlers are wrapped in
    `useCallback`, and read the latest state through a ref (`stateRef`)
    to avoid stale-closure bugs.
-   **Derived state** --- all aggregation values (`overallClasses`,
    `overallPresent`, `overallAbsent`, `overallPercentage`,
    `maxOverallSkippable`, `calculateCanSkip`,
    `calculateClassesToReach75`) are computed during render from
    `subjectsData`. Nothing is duplicated in state.
-   **Hidden WebView** --- once the dashboard is shown, the WebView is
    shrunk to zero dimensions
    (`styles.hiddenWebView: { width: 0, height: 0 }`) rather than
    unmounted, preserving the login session if the user presses Back.
-   **Signature-guarded persistence** --- a `useRef` signature guard
    (`name|subjectsCount|totalClasses|present`) ensures each unique
    completed result is persisted exactly once, preventing duplicate
    writes on re-renders.
-   **Hydration is atomic** --- `HYDRATE_PREVIOUS_RESULT` is a single
    reducer action that sets `isLoggedIn`, `isScrapingFinished`,
    `studentInfo`, `subjectsData`, `currentIndex`, and `fetchedIndices`
    in one pass, so the dashboard renders immediately with no partial
    state.
-   **Color-coded attendance** --- percentages below 75% are red
    (`COLORS.error`), 75--77% are amber (`COLORS.amber`) as a buffer
    zone, and above 77% are green (`COLORS.success`). This gives
    students a visual cue when they're dangerously close to the
    threshold.
-   **Skip and attend calculations** --- the app computes both how many
    classes a student can safely skip (`calculateCanSkip`) and how many
    more classes they must attend to reach 75%
    (`calculateClassesToReach75`), displayed contextually on each
    subject card based on whether attendance is above or below the
    threshold.

------------------------------------------------------------------------

## Project Structure

    .
    ├── App.tsx                    # Main screen: WebView + dashboard + modal + state
    ├── app.json                   # Expo app configuration
    ├── eas.json                   # EAS build profiles + channels
    ├── package.json               # Dependencies & scripts
    ├── tsconfig.json              # TypeScript config (strict, paths: @/* → ./*)
    ├── eslint.config.js           # ESLint / Expo lint config
    ├── AGENTS.md                  # Project conventions & constraints
    ├── README.md                  # This file
    ├── utils/
    │   ├── automationScripts.ts   # JS injection scripts + shared TypeScript types
    │   ├── storage.ts             # Local persistence helpers (expo-file-system)
    │   └── updateManager.ts       # OTA update hook + status types
    └── assets/
        └── images/                # App icons, splash, favicon

### `App.tsx`

The entire user interface and orchestration logic. It contains:

-   **State model** (`AppState`) and reducer (`appReducer`) with typed
    discriminated-union actions.
-   **WebView setup** --- a keyed `WebView` pointed at the portal root
    URL. The `key` prop (`webViewKey`) is bumped by `RESET` to force
    re-mount.
-   **Navigation handler** (`handleNavigationStateChange`) --- routes on
    the current portal page URL and injects the appropriate script when
    `!loading && !scrapingFinished`.
-   **Message handler** (`handleMessage`) --- parses `postMessage`
    payloads (JSON) and dispatches reducer actions via a
    `MessagePayload` discriminated union.
-   **Dashboard UI** --- profile banner, overall summary card, subject
    list (`FlatList`), and the attendance-log modal.
-   **Update banner** --- a slim, non-blocking indicator at the top
    while `expo-updates` checks or applies an OTA update.
-   **Animated loader** (`CrabScene`) --- a pure `Animated` API crab
    walking, hopping, blinking, and sparkling during syncing and error
    states.
-   **Error overlays** --- opaque full-screen overlays for gateway
    errors (502), selection stalls, and sync status.
-   **Back handler** --- Android `BackHandler` integration with
    double-tap-to-exit, plus web `popstate` listener.
-   **Splash screen** --- `SplashScreen.preventAutoHideAsync()` on
    mount, `SplashScreen.hideAsync()` on first `onLoadStart`.

### `utils/automationScripts.ts`

Contains the three injection scripts and the data contracts shared with
the UI:

  -------------------------------------------------------------------------------------------------------------------------------
  Export                                     Role
  ------------------------------------------ ------------------------------------------------------------------------------------
  `autoSubmitFirstSemesterScript`            Reads profile info from `.list-group-item` elements, posts `STUDENT_INFO`, submits
                                             the form whose `action` is `studentsubjects.php`.

  `selectSubjectByIndexScript(index)`        Polls for `tr.clickable-row` rows (up to 20 attempts, 200ms interval), posts
                                             `SUBJECT_COUNT`, clicks the row at the target index, or posts `SCRAPING_COMPLETE`
                                             when the index exceeds the row count.

  `parseDetailedAttendanceAndGoHomeScript`   Parses attendance log rows from `table.table-bordered.table-striped tbody tr` (3
                                             cells: date, time, status badge), posts `ATTENDANCE_ITEM`, then clicks the
                                             `a[href="studenthome.php"]` link after a 300ms delay.

  `StudentInfo`                              `{ name, admissionNo, className }`

  `SubjectAttendanceData`                    `{ subjectName, present, absent, total, percentage, records: AttendanceRecord[] }`

  `AttendanceRecord`                         `{ date, time, status: 'Present' | 'Absent' | 'Unknown' }`
  -------------------------------------------------------------------------------------------------------------------------------

### `utils/storage.ts`

Local persistence of the last scraped result using `expo-file-system`:

  ----------------------------------------------------------------------------------------------------------------
  Export                                   Role
  ---------------------------------------- -----------------------------------------------------------------------
  `PreviousAttendanceResult`               `{ studentInfo: StudentInfo, subjectsData: SubjectAttendanceData[] }`

  `savePreviousResult(result)`             Writes JSON to `{documentDirectory}/previous_attendance_result.json`

  `loadPreviousResult()`                   Reads and shape-validates the JSON file. Returns `null` on
                                           missing/corrupt data --- never throws.

  `clearPreviousResult()`                  Deletes the stored file (available for future reset flows).
  ----------------------------------------------------------------------------------------------------------------

> **\[Updated\]** The import path uses `expo-file-system/legacy` subpath
> for SDK 54 compatibility --- see `utils/storage.ts:1`.

Validation is performed by the type guard
`isPreviousAttendanceResult()`, which checks that `studentInfo` has
string fields and that `subjectsData` is an array where every element
has the correct types.

### `utils/updateManager.ts`

Encapsulates all `expo-updates` logic in one typed module:

  ----------------------------------------------------------------------------------------------------------------------
  Export                                   Role
  ---------------------------------------- -----------------------------------------------------------------------------
  `UpdateStatus`                           Union:
                                           `"checking" \| "applying" \| "ready" \| "upToDate" \| "error" \| "unknown"`

  `UpdateManager`                          Interface: `{ status, checkForUpdate, lastError }`

  `shouldCheckOnMount()`                   Returns `false` in `__DEV__` and in Expo Go (`StoreClient`); returns `true`
                                           in production builds.

  `useUpdateManager()`                     Hook wrapping `Updates.useUpdates()` into the `UpdateStatus` state machine
                                           with a 30-second timeout guard.
  ----------------------------------------------------------------------------------------------------------------------

The `checkForUpdate()` method follows the standard EAS Update flow:
`checkForUpdateAsync()` → if available, `fetchUpdateAsync()` →
`reloadAsync()`. Failures are caught and surfaced via `lastError`
without crashing the app. The hook's internal timer
(`CHECK_TIMEOUT_MS = 30_000`) falls back to `"unknown"` status if the
check exceeds 30 seconds, preventing indefinite blocking.

------------------------------------------------------------------------

## Tech Stack

  Layer           Technology                    Version
  --------------- ----------------------------- ------------------------------
  Framework       Expo SDK                      `~54.0.35`
  Runtime         React Native                  `0.81.5`
  Language        React + TypeScript            `19.1.0` / `~5.9.2` (strict)
  WebView         react-native-webview          `13.15.0`
  Storage         expo-file-system              `~19.0.23`
  OTA             expo-updates                  `~29.0.19`
  Constants       expo-constants                `~18.0.13`
  Splash Screen   expo-splash-screen            `~31.0.13`
  Build config    expo-build-properties         `~1.0.10`
  Web compat      react-native-web              `~0.21.0`
  Linting         ESLint + eslint-config-expo   `^9.25.0` / `~10.0.0`
  Type defs       @types/react                  `~19.1.0`

No external state-management or data-fetching libraries are used --- the
app relies on React's built-in `useReducer` and the WebView bridge. No
Expo Router or navigation library is in use.

> **\[Updated\]** Added `expo-splash-screen`, `react-native-web`, and
> `@types/react` to the tech stack table --- these were present in
> `package.json` but missing from the README.

------------------------------------------------------------------------

## Getting Started

### Prerequisites

-   Node.js LTS
-   npm
-   An Android device/emulator for native testing
-   **Recommended:** an Expo development build (`expo-dev-client`) for
    project development
-   **Optional:** Expo Go for quick UI/prototyping only
-   A valid JNTUA-CEA student portal account

### Install

``` bash
git clone <repository-url>
cd JNTUA-Attendance
npm install
```

### Run

``` bash
npm run start
```

Then:

-   For a quick Expo Go smoke test, run `npm run start` and open the
    project in Expo Go.
-   For production-oriented development, use the development build
    workflow below.

### Recommended development build

Expo Go is useful for rapid prototyping, but this project is intended
for a standalone production application and uses native configuration
such as `expo-build-properties`, `expo-updates`, and
`react-native-webview`. Expo recommends development builds for
production-grade Expo projects because they reproduce the app's own
native runtime instead of relying on the shared Expo Go runtime.

Install the development client once:

``` bash
npx expo install expo-dev-client
```

Build and install the development client:

``` bash
eas build --profile development --platform android
```

Then start Metro for the development build:

``` bash
npx expo start --dev-client
```

This is the preferred workflow for validating native behavior before a
release build. Expo Go may still be used for quick JavaScript/UI checks,
but it is not the release-equivalent runtime.

### Verify lint

``` bash
npm run lint
```

This is the project's mandatory quality gate --- it must pass before any
change is considered complete. Optionally verify types:

``` bash
npx tsc --noEmit
```

------------------------------------------------------------------------

## Usage Guide

### 1. Log in

When the app launches, the embedded portal opens at the login page.
Enter your portal credentials and sign in. The app does not store or
transmit your password anywhere except to the official portal.

### 2. Automatic sync

After login, the app automatically:

-   Detects that you are on the student home page (`studenthome.php`).
-   Collects your profile details (name, admission number, class).
-   Walks through every subject, parsing its attendance log.

A progress screen shows `Processed X of Y subjects` with a completion
percentage, accompanied by an animated crab scene (`CrabScene`) during
sync.

### 3. Read the dashboard

Once syncing finishes, the dashboard appears with:

-   **Student profile** --- name, admission number, and class in a dark
    banner.
-   **Overall summary card** --- combined attendance across all subjects
    with total/attended/missed counts and an overall "can skip" capacity
    pill.
-   **Subject cards** --- each subject shows its name, percentage badge,
    total/attended/missed mini-stats, and a contextual action label:
    -   **Above 75%:** "Skip N classes" (how many you can safely miss)
        or "Keep attending" (if at the limit).
    -   **Below 75%:** "Attend N more" (how many you must attend to
        reach the threshold).
-   **Shortage warnings** --- any subject or the overall total below the
    75% threshold is highlighted in red with a "Shortage" badge. An
    amber zone (75--77%) provides a buffer warning before crossing below
    the threshold.

### 4. Inspect a subject log

Tap any subject card to open a modal listing every recorded attendance
entry (date, time, status). Entries are tagged as **Present**,
**Absent**, or **Unknown** (when the portal did not provide a clear
status badge).

### 5. View previous attendance

When the app starts on the login screen and a previous result is stored
locally, a **Previous Attendance** button appears as a floating coral
pill at the bottom of the screen. Tapping it restores the last scraped
dashboard instantly --- no re-login or re-scrape required. The stored
result is loaded from `expo-file-system` on mount.

### 6. Reset the app

Use the **Back** button in the top-right corner of the dashboard to
return to the login flow. This dispatches `RESET`, which restores the
initial reducer state (clearing all runtime scrape data and
`selectedSubject`) while preserving the stored previous result. It also
increments `webViewKey` to re-mount the WebView fresh from the portal
root. The login session is preserved in the hidden WebView until you
actively log out of the portal.

------------------------------------------------------------------------

## Data Pipeline

The end-to-end flow of a single scrape cycle:

    Portal root
        │  (user logs in through the embedded WebView)
        ▼
    studenthome.php
        │  inject autoSubmitFirstSemesterScript
        │  → STUDENT_INFO postMessage, then submit "subjects" form
        ▼
    studentsubjects.php
        │  inject selectSubjectByIndexScript(currentIndex)
        │  → SUBJECT_COUNT postMessage, click row[currentIndex]
        ▼
    studentsubatt.php
        │  inject parseDetailedAttendanceAndGoHomeScript
        │  → ATTENDANCE_ITEM postMessage, then navigate home
        ▼
    studenthome.php  (repeat for currentIndex = 0..totalSubjects-1)
        │  → SCRAPING_COMPLETE postMessage when currentIndex >= rows.length
        ▼
    Dashboard rendered from aggregated subjectsData
        │  (data persisted to previous_attendance_result.json via expo-file-system)

The messaging protocol between the injected JavaScript and React Native:

  -------------------------------------------------------------------------------------------------------------------
  postMessage type               Payload                                   Triggered by
  ------------------------------ ----------------------------------------- ------------------------------------------
  `STUDENT_INFO`                 `{ type, data: StudentInfo }`             `autoSubmitFirstSemesterScript` on
                                                                           `studenthome.php`

  `SUBJECT_COUNT`                `{ type, count: number }`                 `selectSubjectByIndexScript` on
                                                                           `studentsubjects.php`

  `ATTENDANCE_ITEM`              `{ type, data: SubjectAttendanceData }`   `parseDetailedAttendanceAndGoHomeScript`
                                                                           on `studentsubatt.php`

  `SCRAPING_COMPLETE`            `{ type }`                                `selectSubjectByIndexScript` when target
                                                                           index exceeds row count
  -------------------------------------------------------------------------------------------------------------------

The reducer handles each `ATTENDANCE_ITEM` by: 1. Checking if
`currentIndex` was already fetched (dedup guard via `fetchedIndices`).
2. Appending the item to `subjectsData` and recording the index in
`fetchedIndices`. 3. Advancing `currentIndex` unless the next index
would exceed `totalSubjects`, in which case `isScrapingFinished` is set
to `true`.

------------------------------------------------------------------------

## The 75% Rule Logic

The app evaluates attendance against the standard **75% minimum**
required to sit for semester exams:

    overallPercentage = (totalPresent / totalClasses) * 100
    isShortage = overallPercentage < 75

This single derived value drives all overall-level warning UI (card
background color, status chip label, score color). The same threshold is
applied per subject in the subject list via:

    subjectPercentage = (subjectPresent / subjectTotal) * 100
    isLow = subjectPercentage < 75

Subject cards below 75% use a red background (`cardLowBg`); those at or
above use a white background (`cardNormalBg`).

### Color Threshold Zones

The app uses a three-zone color system for attendance status:

  ----------------------------------------------------------------------------
  Zone           Range             Color                Meaning
  -------------- ----------------- -------------------- ----------------------
  **Shortage**   \< 75%            Red (`COLORS.error`) Below the minimum exam
                                                        threshold

  **Buffer**     75% -- 77%        Amber                Above threshold but
                                   (`COLORS.amber`)     dangerously close

  **Safe**       \> 77%            Green                Comfortably above the
                                   (`COLORS.success`)   75% threshold
  ----------------------------------------------------------------------------

### Skip Capacity Calculation

The app also computes how many future classes a student can miss while
staying above 75%, using a dual-constraint approach:

    maxOverallSkippable = max(0, floor((4 * overallPresent - 3 * overallClasses) / 3))
    canSkip(subject) = min(
      max(0, floor((4 * subjectPresent - 3 * subjectTotal) / 3)),
      maxOverallSkippable
    )

The overall constraint ensures the per-subject skip count cannot push
the aggregate below 75%, even if an individual subject has surplus
attendance. This value is displayed per subject as `Skip N classes` or
`Keep attending` and overall in the summary card.

### Classes to Reach 75%

For subjects below the threshold, the app calculates how many additional
classes the student must attend to reach 75%:

    classesToReach75 = max(0, 3 * total - 4 * present)

This is displayed per subject as `Attend N more` when the subject is in
shortage territory.

------------------------------------------------------------------------

## Previous Attendance Persistence

The app persists the most recently scraped result so it survives app
restarts. This feature is implemented in `utils/storage.ts` and
integrated into `App.tsx`:

**Storage backend:** `expo-file-system` writes a JSON file
(`previous_attendance_result.json`) to `FileSystem.documentDirectory`.
The import uses the `/legacy` subpath (`expo-file-system/legacy`) as
required by Expo SDK 54.

**What is persisted:** Only `studentInfo` and `subjectsData` --- all
aggregates are derived at render time, so nothing is duplicated in
storage.

**When it is saved:** Once, immediately when a scrape completes and the
data is fully in memory, guarded by a `useRef` signature
(`name|subjectsCount|totalClasses|present`) to ensure idempotent,
single-write per unique result. The persistence `useEffect` also
dispatches `SET_PREVIOUS_RESULT` so the "Previous Attendance" button
appears without requiring a fresh mount.

**When it is loaded:** On app mount via a `useEffect` that calls
`loadPreviousResult()` and dispatches `SET_PREVIOUS_RESULT`. The loader
validates the persisted shape and returns `null` on corruption --- it
never throws.

**How it is restored:** When `hasPreviousResult` is true and the user is
on the login screen (`!isLoggedIn`), a **Previous Attendance** button is
rendered overlaying the WebView. Tapping it dispatches
`HYDRATE_PREVIOUS_RESULT`, which atomically sets `isLoggedIn`,
`isScrapingFinished`, `studentInfo`, and `subjectsData`, causing the
existing dashboard to render immediately with zero re-scraping and no
WebView re-authentication.

**Back button behavior:** The `RESET` action (triggered by the Back
button) returns to `initialState` via `preserveSession`, preserving
`hasPreviousResult`, `previousResult`, and `isSplashDismissed`, so the
button reappears after resetting.

------------------------------------------------------------------------

## Mobile UX Features

### Animated Loader (CrabScene)

During the "Authenticating session..." phase and subject syncing, a pure
`Animated` API crab scene (`CrabScene`) renders at the center of the
screen. The animation includes: - **Walking** --- horizontal translation
across the screen. - **Hopping** --- vertical bounce with squash/stretch
on landing. - **Leg movement** --- alternating leg animation for a
walking gait. - **Blinking** --- periodic eye closure for a livelier
feel. - **Sparkle ring** --- a scaling ring with three particle sparks
that appear during the hop.

No external animation libraries are used --- the entire effect is built
with `Animated.timing`, `Animated.sequence`, `Animated.parallel`, and
`Animated.loop`.

### Splash Screen Management

-   `SplashScreen.preventAutoHideAsync()` is called once (guarded by a
    `useRef` so it only fires on the very first render).
-   The splash screen is hidden (`SplashScreen.hideAsync()`) on the
    first `onLoadStart` WebView callback, gated by `isSplashDismissed`
    state so it only fires once per session.

### Android Back Handler

The app implements a multi-state Android back handler: - **Modal open**
--- closes the attendance log modal. - **Dashboard shown** ---
dispatches `RESET` to return to login flow. - **Selection error shown**
--- dismisses the error overlay. - **Otherwise** --- double-tap within 2
seconds exits the app; single tap shows a "Press back again to exit"
toast.

On web, a `popstate` listener intercepts browser back navigation, routes
it through the same logic, and re-pushes the history state to prevent
leaving the app.

### Custom User Agent

The WebView uses a custom Android Chrome user agent string to ensure the
portal renders the mobile-optimized version:

    Mozilla/5.0 (Linux; Android 13; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36

------------------------------------------------------------------------

## Error Handling

The app implements two error-detection mechanisms to handle portal
unreliability:

### 1. Stall Detection

When the app is logged in but scraping has not finished, an interval
checks `lastActivityRef` every second. If no `postMessage` arrives
within `STALL_TIMEOUT_MS` (15 seconds), `SET_SELECTION_ERROR` is
dispatched. This displays an opaque overlay with a "Couldn't load
subjects right now" message, explaining that the portal was recently
updated and the app can't detect subjects at the moment. A "Try again"
button dispatches `RESET`.

### 2. Gateway Error Handling (HTTP 502)

When the portal returns a 502 Bad Gateway, `SET_GATEWAY_ERROR` is
dispatched. This displays an opaque overlay with the `CrabScene`
animation and the message "Main attendance website is not working", with
a "Try again" button. Any subsequent `onLoadStart` call dispatches
`CLEAR_GATEWAY_ERROR` to dismiss the overlay once the page loads
normally.

### Error Dismissal

Both error states are cleared by: - The hardware back handler
(Android). - A "Try again" button that dispatches `RESET` (full session
reset). - Natural recovery (`CLEAR_GATEWAY_ERROR` on next successful
page load).

------------------------------------------------------------------------

## OTA Updates (EAS Update)

The app uses **pure EAS Update** to ship scraper-script fixes and minor
UI tweaks over-the-air --- no store reinstall or native rebuild
required. The scraping logic lives in `utils/automationScripts.ts` and
the UI in `App.tsx`, both pure JavaScript/TypeScript bundled into the JS
runtime, making them ideal OTA targets.

### Channels

Two channels provide a safe rollout path:

  -----------------------------------------------------------------------
  Channel             Build profile                   Purpose
  ------------------- ------------------------------- -------------------
  `staging`           `preview` (APK)                 Validate a new
                                                      update before
                                                      reaching users

  `production`        `production` (APK, version      Live updates
                      auto-incremented)               delivered to all
                                                      users
  -----------------------------------------------------------------------

The app checks for updates on launch (`app.json` →
`updates.checkAutomatically: "ON_LOAD"`), guarded by
`shouldCheckOnMount()` in `utils/updateManager.ts` (skipped in `__DEV__`
and Expo Go). A lightweight, non-blocking banner at the top of the
screen shows "Checking for updates..." or "Applying update..." while the
lifecycle runs.

The `useUpdateManager` hook implements a 30-second timeout
(`CHECK_TIMEOUT_MS = 30_000`) on update checks --- if a check exceeds
this, the status falls back to `"unknown"` to avoid blocking the user
indefinitely.

### Publishing Runbook

``` bash
# 1. Authenticate with Expo (one-time)
eas-cli login

# 2. Create a staging build (one-time — includes native config)
npm run build:preview

# 3. Publish a JS-only update to staging (every time automationScripts.ts or App.tsx changes)
npm run update:staging

# 4. Validate on the staging build, then promote to production
npm run promote:production

# Or publish directly to production
npm run update:production
```

### Native Build Runbook

``` bash
# Staging (APK, staging channel)
npm run build:preview

# Production (APK, production channel, version auto-incremented)
npm run build:production
```

**Important:** `eas update` only ships changes to the JS bundle. Any
change to native modules, `app.json` native config, or new native
dependencies requires a fresh build (`npm run build:production`) rather
than an update. The `runtimeVersion` uses the `appVersion` policy
(`app.json`), so bumping the `version` field forces a fresh native
build. The `eas.json` → `cli.appVersionSource: "remote"` setting means
the version is sourced from the Expo servers during build, enabling
`autoIncrement: true` on the production profile.

### Configuration

-   **Update URL:**
    `https://u.expo.dev/214d3218-11c5-4156-8a95-12843b24cd74` (set in
    `app.json` → `updates.url`)
-   **EAS Project ID:** `554d405b-1ed9-4bb5-bd9f-f8af967a3634` (set in
    `app.json` → `extra.eas.projectId`)
-   **Runtime version policy:** `appVersion` --- the `version` field in
    `app.json` determines update compatibility.
-   **Channel mapping:** defined in `eas.json` --- `preview` profile →
    `staging` channel, `production` profile → `production` channel.

------------------------------------------------------------------------

## Production Readiness

The production profile builds a standalone Android APK with release
optimizations enabled. `app.json` enables `arm64-v8a`, R8/minification,
and resource shrinking, while `eas.json` maps the production build to
the `production` EAS Update channel.

Before a production build, run:

``` bash
npm ci
npm run lint
npx tsc --noEmit
npx expo-doctor
```

If `npm ci` reports that `package.json` and `package-lock.json` are out
of sync, fix the lockfile locally with `npm install`, review the
dependency changes, commit the updated lockfile, and run `npm ci` again.
Do not work around an EAS `npm ci` failure by deleting the lockfile.

### Production build

``` bash
npm run build:production
```

The current production profile uses an APK. If the intended distribution
is Google Play, generate an Android App Bundle instead of an APK by
changing the production `android.buildType` to `app-bundle` before the
store release.

### Expo Go build warning

EAS may print:

``` text
Detected that your app uses Expo Go for development, this is not recommended when building production apps.
```

This is a **warning, not a production build failure**. Your current
`eas.json` already defines `EAS_BUILD_NO_EXPO_GO_WARNING=true` in the
production profile, but the log shows the warning is emitted **before**
the profile environment variables are loaded. Therefore that
profile-level variable cannot suppress this early CLI warning.

If you only want to suppress the CLI message on Linux/macOS, set the
variable in the shell before invoking EAS:

``` bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:production
```

Or make the npm script itself suppress it:

``` json
"build:production": "EAS_BUILD_NO_EXPO_GO_WARNING=true eas build --profile production --platform android"
```

Do not add `expo-dev-client` merely to silence this warning. The correct
reason to use `expo-dev-client` is to make development/testing use your
own native runtime. The production binary itself is already a standalone
EAS build.

### What requires a new build vs. an OTA update

  Change                                            EAS Update   New production build
  ----------------------------------------------- ------------ ----------------------
  `App.tsx` JavaScript/TypeScript                          Yes                     No
  `utils/automationScripts.ts` scraper logic               Yes                     No
  Styling/UI-only changes                                  Yes                     No
  Native dependency added/removed                           No                    Yes
  `app.json` native configuration changed                   No                    Yes
  `expo-build-properties` configuration changed             No                    Yes
  Native Android/iOS code changed                           No                    Yes
  Runtime compatibility changed                             No                    Yes

The `runtimeVersion` policy is `appVersion`, so OTA updates are only
delivered to binaries with the compatible runtime version. Expo
recommends treating runtime compatibility as a release boundary: when
native code or native configuration changes, create a new binary rather
than publishing a JavaScript-only update.

### Recommended release sequence

1.  Build the `preview` profile.
2.  Publish the candidate update to `staging`.
3.  Test the actual standalone build, not only Expo Go.
4.  Promote the verified update to `production`, or publish directly to
    `production` when appropriate.
5.  For native changes, build a new production binary.

------------------------------------------------------------------------

## Troubleshooting

  -------------------------------------------------------------------------------------------
  Symptom            Likely Cause                             Resolution
  ------------------ ---------------------------------------- -------------------------------
  Stuck on           Portal page structure changed, or the    Wait a few seconds for the
  "Authenticating    home page loaded before DOM was ready    injected script to retry; if
  session..."                                                 persistent, tap **Back** and
                                                              retry the login.

  "Processed 0 of 0  The portal's subject-row selector        The portal DOM likely changed;
  subjects" or no    (`tr.clickable-row`) did not match any   update
  progress           rows                                     `selectSubjectByIndexScript` in
                                                              `utils/automationScripts.ts`.

  No subjects appear `autoSubmitFirstSemesterScript` failed   Portal structure changed;
  after login        to find the subjects form                review and update the form
                     (`form[action="studentsubjects.php"]`)   selector.

  "Couldn't load     No `postMessage` received for 15 seconds Tap **Try again** to reset and
  subjects right     (stall detection)                        retry. If the portal page
  now" overlay                                                structure changed, update the
  appears                                                     scraping scripts.

  "Main attendance   The portal returned an HTTP 502 Bad      Tap **Try again** to reset. The
  website is not     Gateway                                  overlay auto-clears once the
  working" overlay                                            portal responds normally.
  appears                                                     

  `Unknown` statuses Portal table lacked a status badge       Expected --- the app marks
  in the log         (`span.badge`) for some rows             unclear entries as `Unknown`
                                                              rather than dropping them.

  Previous           No previous result was persisted, or the Complete a full scrape once to
  Attendance button  stored JSON is corrupt                   create a valid stored result;
  missing after                                               the loader validates shape and
  restart                                                     returns `null` on corruption.

  Dashboard shows    Scraping was interrupted mid-way         Tap **Back** and
  partial subject                                             re-authenticate to restart the
  data                                                        full scrape.

  Lint fails         Code does not meet the project quality   Run `npm run lint`, read the
                     gate                                     errors, and fix the root cause
                                                              --- never disable rules or
                                                              inject `@ts-ignore`.
  -------------------------------------------------------------------------------------------

------------------------------------------------------------------------

## Contributing

1.  Fork the repository and create a feature branch.
2.  Make minimal, strictly-typed changes following the conventions in
    `AGENTS.md`.
3.  Run `npm run lint` and ensure it passes with zero errors.
4.  Run `npx tsc --noEmit` to verify type correctness.
5.  Test JavaScript/UI changes with Expo Go if convenient, but validate
    native and release-sensitive behavior with the `development` or
    `preview` EAS build.
6.  For release changes, follow the **Production Readiness** and **OTA
    Updates** runbooks above.
7.  Submit a pull request with a clear description of the change.

**Guidelines:** - Never use `@latest` for dependencies --- always use
`npx expo install` for SDK 54 compatibility. - Keep logic, styling,
state management, and UI rendering cleanly decoupled. - Derive
calculated values at render --- never duplicate state. - Scraping
scripts must always end with `true;` to keep the WebView bridge alive. -
For scraper DOM changes, test against the live portal and update
`AGENTS.md` troubleshooting if the symptom changes.

------------------------------------------------------------------------

## License

This project is provided for educational use. It is not affiliated with
or endorsed by JNTUA or the classattendance.in portal. Use it
responsibly and in accordance with your institution's policies.
