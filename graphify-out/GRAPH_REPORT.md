# Graph Report - JNTUA-Attendance  (2026-08-12)

## Corpus Check
- 13 files · ~89,888 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 250 nodes · 273 edges · 15 communities (14 shown, 1 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `317c7bc7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- App.tsx
- dependencies
- expo
- scripts
- JNTUA Attendance
- devDependencies
- tsconfig.json
- android
- eslint.config.js
- AGENTS.md
- BUILD-RULES.md
- 9. Final Production Gate — Mandatory
- Usage Guide
- Getting Started
- Production Readiness

## God Nodes (most connected - your core abstractions)
1. `JNTUA Attendance` - 19 edges
2. `expo` - 15 edges
3. `9. Final Production Gate — Mandatory` - 12 edges
4. `scripts` - 10 edges
5. `Index()` - 7 edges
6. `Usage Guide` - 7 edges
7. `android` - 6 edges
8. `5. Architectural & Code Quality Rules` - 6 edges
9. `6. Error Handling & Mobile UX` - 6 edges
10. `12. Production Release Checklist` - 6 edges

## Surprising Connections (you probably didn't know these)
- `AppState` --references--> `StudentInfo`  [EXTRACTED]
  App.tsx → utils/automationScripts.ts
- `AppState` --references--> `SubjectAttendanceData`  [EXTRACTED]
  App.tsx → utils/automationScripts.ts
- `AppState` --references--> `PreviousAttendanceResult`  [EXTRACTED]
  App.tsx → utils/storage.ts
- `Index()` --calls--> `selectSubjectByIndexScript()`  [EXTRACTED]
  App.tsx → utils/automationScripts.ts
- `Index()` --calls--> `loadPreviousResult()`  [EXTRACTED]
  App.tsx → utils/storage.ts

## Import Cycles
- None detected.

## Communities (15 total, 1 thin omitted)

### Community 0 - "App.tsx"
Cohesion: 0.12
Nodes (27): AppAction, appReducer(), AppState, COLORS, Index(), initialState, MessagePayload, preserveSession() (+19 more)

### Community 1 - "dependencies"
Cohesion: 0.09
Nodes (23): expo, expo-build-properties, expo-constants, expo-file-system, expo-splash-screen, expo-updates, dependencies, expo (+15 more)

### Community 2 - "expo"
Cohesion: 0.09
Nodes (21): projectId, reactCompiler, expo, experiments, extra, icon, name, newArchEnabled (+13 more)

### Community 3 - "scripts"
Cohesion: 0.12
Nodes (16): allowScripts, unrs-resolver@1.12.2, main, name, private, scripts, android, build:preview (+8 more)

### Community 4 - "JNTUA Attendance"
Cohesion: 0.06
Nodes (35): 1. Stall Detection, 2. Gateway Error Handling (HTTP 502), Android Back Handler, Animated Loader (CrabScene), `App.tsx`, Architecture, Channels, Classes to Reach 75% (+27 more)

### Community 5 - "devDependencies"
Cohesion: 0.22
Nodes (9): eslint, eslint-config-expo, devDependencies, eslint, eslint-config-expo, @types/react, typescript, @types/react (+1 more)

### Community 6 - "tsconfig.json"
Cohesion: 0.22
Nodes (8): expo/tsconfig.base, **/*.ts, **/*.tsx, compilerOptions, paths, strict, extends, include

### Community 7 - "android"
Cohesion: 0.25
Nodes (8): backgroundColor, adaptiveIcon, edgeToEdgeEnabled, package, permissions, predictiveBackGestureEnabled, android, INTERNET

### Community 9 - "AGENTS.md"
Cohesion: 0.06
Nodes (32): 1. Prohibition of `@latest`, 1. Project Identity & Governance, 2. Pinned Technical Stack, 2. Standard Installation Method, 3. Dependency Pre-checks, 3. Mandatory Lint Gate, 4. Native Dependency Impact, 4. Package & Dependency Rules (+24 more)

### Community 10 - "BUILD-RULES.md"
Cohesion: 0.08
Nodes (24): 10. Required Verification Pipeline, 11. WebView Safety Rules, 12. Production Release Checklist, 13. Hard Failure Policy, 14. Agent Rule, 1. Non-Negotiable Build Targets, 2. Dependency Minimalism, 3. Mandatory Unused-Package Cleanup (+16 more)

### Community 11 - "9. Final Production Gate — Mandatory"
Cohesion: 0.17
Nodes (12): 9. Final Production Gate — Mandatory, A. Dependency Hygiene, B. Architecture Gate, C. Expo Go / Development Gate, D. Static Quality Gate, E. Configuration Gate, F. OTA Gate, G. WebView Production Gate (+4 more)

### Community 12 - "Usage Guide"
Cohesion: 0.29
Nodes (7): 1. Log in, 2. Automatic sync, 3. Read the dashboard, 4. Inspect a subject log, 5. View previous attendance, 6. Reset the app, Usage Guide

### Community 13 - "Getting Started"
Cohesion: 0.33
Nodes (6): Getting Started, Install, Prerequisites, Recommended development build, Run, Verify lint

### Community 14 - "Production Readiness"
Cohesion: 0.40
Nodes (5): Expo Go build warning, Production build, Production Readiness, Recommended release sequence, What requires a new build vs. an OTA update

## Knowledge Gaps
- **166 isolated node(s):** `COLORS`, `STATUS_COLOR`, `initialState`, `AppAction`, `MessagePayload` (+161 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `JNTUA Attendance` connect `JNTUA Attendance` to `Usage Guide`, `Getting Started`, `Production Readiness`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `scripts`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **Why does `9. Final Production Gate — Mandatory` connect `9. Final Production Gate — Mandatory` to `AGENTS.md`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `COLORS`, `STATUS_COLOR`, `initialState` to the rest of the system?**
  _166 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `App.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.11931818181818182 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `expo` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._