# Credential policy

- Do not commit real API keys, access tokens, service-account JSON or private keys.
- Do not embed secrets in static assets, even through GitHub Actions secrets: assets delivered to a browser are public.
- Google sign-in and cloud sync are currently disabled. Existing local records and backups remain usable; cloud records are not deleted.
- Firebase's browser configuration normally uses a public project-identification key. That design is not compatible with keeping that key private. Restore cloud access only after agreeing to a server-backed architecture or explicitly accepting properly restricted public client configuration.
- The previously published key must be revoked/replaced in Google Cloud Console. Removing source code does not revoke a credential.
- Rewriting main cannot erase downloaded copies, browser/CDN caches or all GitHub commit/artifact references. Follow GitHub's sensitive-data removal procedure if those copies must be purged.
