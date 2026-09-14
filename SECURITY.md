# Credential policy

- Do not commit real API keys, access tokens, service-account JSON or private keys.
- Do not embed secrets in static assets, even through GitHub Actions secrets: assets delivered to a browser are public.
- The server-backed Google sign-in API is implemented. Until its Cloud Run URL and public OAuth client ID are configured, cloud access stays disabled. Existing local records and backups remain usable; cloud records are not deleted.
- Firebase browser API keys are not used. Server Firestore access uses Cloud Run's Application Default Credentials; deployment uses GitHub OIDC. Do not create a service-account JSON key. OAuth client ID and API URL are public identifiers; OAuth client secrets are not required.
- User Google ID tokens are dynamic bearer credentials held only in memory. They are sent only in Authorization headers over HTTPS, never logged, put in URLs, or committed. All data endpoints verify Google signature/audience/issuer/expiry and choose the UID server-side. Logout discards this tab's token; expiry limits reuse, but logout is not Google-side revocation.
- CORS restricts browser origins but is not authentication or a network firewall. Service accounts, GitHub write permissions, dependencies, browser XSS risk, API quota and billing need ongoing management. See BACKEND_SETUP.md.
- The previously published key must be revoked/replaced in Google Cloud Console. Removing source code does not revoke a credential.
- Rewriting main cannot erase downloaded copies, browser/CDN caches or all GitHub commit/artifact references. Follow GitHub's sensitive-data removal procedure if those copies must be purged.
