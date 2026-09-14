# Credential policy

- Never commit passwords, access/refresh tokens, service-account JSON or private keys. No credentials are injected by GitHub Actions.
- Firebase Web API keys are public configuration, not authorization. This app nevertheless keeps the configuration out of GitHub and static assets: users enter it per-device through the configuration dialog. Only five allowlisted public fields are accepted.
- Email/password is transmitted only to Firebase Authentication through the official SDK. Application code does not persist or log it. Auth persistence is in-memory; reload requires sign-in. A password manager may save credentials independently.
- Firestore Rules must be deployed with the dedicated owner's UID. Client-side owner checks are only UX; Rules are the authorization boundary. The checked-in placeholder does not authorize the real owner. Only the owner's exact state document can be accessed; all other paths, list and delete are denied.
- Firestore access uses optimistic transactions to prevent overwriting another device's revision. Failed cloud writes remain marked pending in device storage.
- Device task caches and pending records remain in localStorage after logout; use separate browser profiles or clear site data on shared devices. Do not treat logout as cache erasure or immediate revocation of stolen tokens.
- Protect Firebase project administrators, browser integrity, API restrictions and quotas. Public client configuration does not prevent resource abuse. See FIREBASE_SETUP.md.
- Previously published credentials must be revoked at the provider. Removing source/history cannot remove downloaded copies, all caches or orphan commit references.
- The old backend directory is retained as legacy source, is not used by the app, and its deployment workflow has been removed. Do not deploy BACKEND_SETUP.md for the current configuration.
