# DealScout mobile

The mobile app is the native DealScout shopper surface. It mirrors the website's public deal experience and consumes the same `/api/v1` contracts through the shared platform-neutral client in `src/lib/apiCore.js`.

It does **not** own deal verification, publication eligibility, pricing truth, admin operations, or provider access.

## Local development

From `apps/mobile`:

```bash
npm ci
EXPO_PUBLIC_API_URL=http://localhost:3000 npm start
```

For a physical device, `localhost` points at the device itself. Use an HTTPS development/staging API origin reachable by the device, or an appropriate local-network development setup.

`EXPO_PUBLIC_API_URL` is required outside local development and must be an absolute HTTPS origin. Do not put API secrets in `EXPO_PUBLIC_*` variables; Expo public variables are embedded in the client bundle.

## Quality gate

The repository `Mobile Quality` workflow installs from `apps/mobile/package-lock.json` and runs an Expo export for all supported platforms. A mobile release should not proceed unless both `Quality` and `Mobile Quality` are green for the release commit.

For a local equivalent:

```bash
npm ci
EXPO_PUBLIC_API_URL=https://staging-api.example.com npm run export
```

## EAS builds

`app.json` keeps stable app identity such as bundle/package identifiers in source control. `app.config.js` layers release-account metadata from the build environment so linking a real Expo account does not require committing one developer's account/project identifiers.

Production release variables:

- `EAS_PROJECT_ID` — the linked Expo/EAS project UUID. Required by the root launch preflight for production release readiness unless a project ID is explicitly checked into the Expo config.
- `EXPO_OWNER` — optional Expo account/organization owner.
- `EXPO_PUBLIC_API_URL` — deployed HTTPS DealScout API origin used by the app.
- `EXPO_PUBLIC_PRIVACY_URL` — public HTTPS privacy-policy URL used for release/store metadata.
- `EXPO_PUBLIC_SUPPORT_URL` — public HTTPS support URL used for release/store metadata.

Only public, client-safe values belong in `EXPO_PUBLIC_*`. Apple/Google signing credentials and store API credentials must remain in EAS or another secret store.

`eas.json` defines development, preview, and production profiles. Before the first real store build:

1. Create/link the real Expo/EAS project and set `EAS_PROJECT_ID` in the EAS build environment.
2. Verify that `ios.bundleIdentifier` and `android.package` are the identifiers owned for DealScout. Do not change identifiers after store records are created without understanding the migration impact.
3. Configure `EXPO_PUBLIC_API_URL` for the build profile/environment to the deployed HTTPS DealScout API origin.
4. Configure real HTTPS privacy/support URLs and make sure they are reachable without authentication.
5. Configure Apple/Google signing through EAS or the chosen CI secret store; never commit signing credentials.
6. Supply final app icon, adaptive icon, splash/store artwork, screenshots, descriptions, and remaining store metadata before submission.
7. Run the backend release smoke against the exact API origin used by the build before creating the production binary.

Typical production commands once EAS project/store credentials exist:

```bash
EAS_PROJECT_ID=<project-uuid> \
EXPO_PUBLIC_API_URL=https://api.example.com \
EXPO_PUBLIC_PRIVACY_URL=https://example.com/privacy \
EXPO_PUBLIC_SUPPORT_URL=https://example.com/support \
npx eas build --profile production --platform ios

EAS_PROJECT_ID=<project-uuid> \
EXPO_PUBLIC_API_URL=https://api.example.com \
EXPO_PUBLIC_PRIVACY_URL=https://example.com/privacy \
EXPO_PUBLIC_SUPPORT_URL=https://example.com/support \
npx eas build --profile production --platform android
```

Store submission remains an explicit release action; it is not performed by repository CI.

## Native identity and saved deals

The native API adapter persists guest/auth identity with secure native storage and sends the same identity contract used by the website. Saved deals therefore come from shared backend state rather than a separate native-only database.

## Product parity

The website and app should remain the same DealScout shopper product: the same verified catalog, cursor feed, search semantics, deal detail truth, saved-deal behavior, Amazon destination, brand line, and featured-deal intent. Native navigation, storage, gestures, and platform presentation may differ, but business truth should not fork into app-only logic.
