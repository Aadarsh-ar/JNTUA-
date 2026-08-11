# BUILD-RULES.md

## JNTUA Attendance — Build, Dependency & Release Rules

This document is the hard build policy for the project. Agents must follow it before modifying dependencies, native configuration, or producing an EAS artifact.

---

## 1. Non-Negotiable Build Targets

| Rule | Required value |
|---|---|
| Expo SDK | 54 |
| React Native | 0.81.5 |
| Android ABI | `arm64-v8a` only |
| Release minification | Enabled |
| Release resource shrinking | Enabled |
| Production EAS channel | `production` |
| Staging EAS channel | `staging` |
| OTA runtime policy | `appVersion` |
| Package manager | npm |
| Lockfile | `package-lock.json` |

Never silently change these values.

---

## 2. Dependency Minimalism

The application must contain only dependencies that are actually required.

### Before adding a package

An agent MUST answer:

1. What exact feature requires this package?
2. Can the feature be implemented using an existing dependency?
3. Can it be implemented using React Native, Expo SDK 54, or standard TypeScript/JavaScript?
4. Does the package add native code?
5. Is it compatible with Expo SDK 54?
6. Is it needed at runtime, build time, or development time?

If there is no concrete answer, **do not add the package**.

### Installation rule

For Expo-managed packages:

```bash
npx expo install <package>
```

Do not use:

```bash
npm install <expo-package>@latest
```

Do not blindly install packages from Expo's default/template ecosystem.

---

## 3. Mandatory Unused-Package Cleanup

Before every production release, audit direct dependencies.

Inspect:

```bash
cat package.json
npm ls --depth=0
```

Then search the repository for actual usage.

A direct package is removable when all of the following are true:

- it is not imported by application/source code;
- it is not required by `app.json` or an Expo config plugin;
- it is not required by an npm script;
- it is not required by EAS/native configuration;
- it is not required by ESLint/TypeScript/build tooling;
- it is not intentionally retained for a documented reason.

Remove unused packages with npm:

```bash
npm uninstall <package>
```

Then regenerate and verify:

```bash
npm install
npm ci
npm ls --depth=0
```

**Do not manually delete random entries from `package-lock.json`.**

The goal is:

```text
Required package
      ↓
known consumer
      ↓
documented purpose
```

not:

```text
Expo template
      ↓
dozens of unused packages
      ↓
larger dependency graph
```

---

## 4. Current Application Runtime Dependencies

Keep only dependencies demonstrably required by the current application.

Known active application capabilities include:

- `react-native-webview` — portal WebView and JavaScript bridge.
- `expo-updates` — OTA update lifecycle.
- `expo-file-system` — local attendance persistence.
- `expo-constants` — standalone/execution-environment detection.
- `expo-splash-screen` — splash lifecycle.
- `expo-build-properties` — native Android build configuration.
- `react-native-web` — only where required by the configured platform/toolchain.

Do not remove one of these merely because its import is not visible in `App.tsx`. Check config plugins, utility modules, scripts, and native build configuration first.

The source of truth remains the actual repository state, not this list.

---

## 5. ARM64-Only Policy

Android must build only:

```text
arm64-v8a
```

Do not build:

```text
armeabi-v7a
x86
x86_64
```

The effective Expo build configuration must preserve:

```json
{
  "android": {
    "buildArchs": ["arm64-v8a"]
  }
}
```

If a dependency introduces unsupported ABI requirements, investigate the dependency rather than automatically enabling additional architectures.

Do not trade the project's explicit ARM64-only requirement for compatibility without user approval.

---

## 6. Production Optimization

Release builds must retain:

```text
minification = enabled
resource shrinking = enabled
ARM64-only
```

Do not disable minification or resource shrinking merely to make a build succeed.

If a release-only failure occurs:

1. identify the actual failing dependency/configuration;
2. fix the cause;
3. rerun the release build;
4. do not weaken release optimizations as the first workaround.

---

## 7. Expo Go Policy

Expo Go is permitted for quick development/prototyping only.

It is not the production validation target.

Preferred native development workflow:

```bash
eas build --profile development --platform android
npx expo start --dev-client
```

Production/staging validation must use an EAS-built standalone application.

The environment variable:

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true
```

only suppresses the CLI warning. It does not make Expo Go equivalent to a standalone production runtime.

---

## 8. OTA Update Rules

The project uses EAS Update.

### OTA-eligible

Examples:

- `App.tsx`
- UI changes
- TypeScript logic
- scraper JavaScript
- non-native configuration consumed only by JavaScript

### New native build required

Examples:

- adding/removing native dependencies;
- changing native Expo config/plugins;
- Android native configuration;
- `expo-build-properties` changes;
- Android ABI changes;
- native Android/iOS code;
- changes incompatible with the existing runtime version.

Never publish an OTA update for a change that requires native code to exist in the installed binary.

---

## 9. Lockfile Integrity

`package.json` and `package-lock.json` must remain synchronized.

Before EAS:

```bash
npm ci
```

must succeed locally.

If it fails with:

```text
npm ci can only install packages when your package.json and package-lock.json ... are in sync
```

do not start an EAS build.

Fix it:

```bash
npm install
npm ci
```

Commit both manifests.

Do not use `npm install --force`, `--legacy-peer-deps`, or manual lockfile edits as a generic solution.

---

## 10. Required Verification Pipeline

Every production-affecting change must pass:

```bash
npm ci
npm run lint
npx tsc --noEmit
npx expo-doctor
```

Then build a staging/preview artifact:

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:preview
```

Install and test it on a physical ARM64 Android device.

Only after that passes:

```bash
EAS_BUILD_NO_EXPO_GO_WARNING=true npm run build:production
```

---

## 11. WebView Safety Rules

The app's core data path is:

```text
JNTUA portal
    ↓
WebView
    ↓
injected JavaScript
    ↓
postMessage
    ↓
React Native
    ↓
typed application state
```

Agents must not:

- store portal passwords;
- print credentials/session information to logs;
- send scraped credentials to third-party services;
- replace the HTTPS portal with an HTTP endpoint;
- broaden WebView navigation unnecessarily;
- assume a TypeScript cast validates untrusted WebView messages.

WebView bridge payloads should be runtime-validated before business logic consumes them.

---

## 12. Production Release Checklist

### Dependencies

- [ ] No unused direct dependencies.
- [ ] No accidental Expo packages.
- [ ] No `@latest`.
- [ ] SDK 54 compatibility verified.
- [ ] `package.json` and lockfile synchronized.
- [ ] `npm ci` passes.

### Code

- [ ] `npm run lint` passes.
- [ ] `npx tsc --noEmit` passes.
- [ ] `npx expo-doctor` passes.
- [ ] No suppressed type/lint errors.
- [ ] No debug credential/data logging.

### Native build

- [ ] ARM64 only.
- [ ] Release minification enabled.
- [ ] Resource shrinking enabled.
- [ ] Native dependencies/configuration reviewed.

### Functional

- [ ] Login works.
- [ ] Student information extraction works.
- [ ] Subject discovery works.
- [ ] Every subject can be scraped.
- [ ] Attendance parsing works.
- [ ] Dashboard calculations are correct.
- [ ] Previous attendance works.
- [ ] Reset/back behavior works.
- [ ] Portal failure handling works.
- [ ] OTA update flow works in a standalone build.

### Release

- [ ] Preview EAS build succeeds.
- [ ] Preview artifact tested on ARM64 Android.
- [ ] Production EAS build succeeds.
- [ ] Correct EAS channel selected.
- [ ] Correct runtime version selected.
- [ ] Artifact type matches distribution target.

---

## 13. Hard Failure Policy

The following are release blockers:

```text
npm ci failure
lint failure
TypeScript failure
Expo Doctor failure
dependency/lockfile mismatch
non-ARM64 production ABI
unreviewed native dependency
broken WebView scraping flow
broken OTA runtime compatibility
production build failure
```

Do not mark the project "production ready" while any blocker remains.

---

## 14. Agent Rule

Agents must optimize for:

```text
small dependency graph
+
small native footprint
+
ARM64-only artifact
+
reproducible npm install
+
reproducible EAS build
+
strict verification
```

Do not optimize for:

```text
maximum number of libraries
+
template completeness
+
"it builds on my machine"
```

A successful build is not sufficient. The final verification gates must pass.
