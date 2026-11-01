# Security Policy

## Supported scope

Security fixes are handled against the current `main` branch and the currently deployed site. Old branches and historical audit snapshots are not supported release lines, but historical credential exposure still requires provider-side revocation or rotation.

## Reporting a vulnerability

Do not publish suspected exploitable vulnerabilities, credential values, private URLs, access tokens or proof-of-concept payloads in public issues, pull requests or discussions.

Use GitHub's private vulnerability reporting from the repository Security tab when it is enabled. If private reporting is unavailable, contact the site owner through a private channel before public disclosure. Include the affected component, impact, a minimal reproducible description and the affected commit, but never include a live secret value.

## Credentials and exposure response

Never commit API keys, OAuth tokens, bot tokens, passwords, private keys, production environment files or customer data.

If a credential may have been exposed:
1. identify its type and provider without copying its value into the report;
2. revoke or rotate it at the provider;
3. verify the replacement through the existing owner-controlled operational process;
4. remove the exposed value from reachable Git history where appropriate, but do not treat history rewriting as revocation.

## Automated controls

- Gitleaks scans the full Git history on pull requests, pushes to `main` and a weekly schedule.
- Dependabot opens reviewable npm and GitHub Actions update PRs. Dependency updates are not configured for automatic merging.
- The repository-hygiene workflow enforces immutable GitHub Actions commit pins and rejects tracked generated or temporary files.

## Responsible testing

Test only systems, accounts and data that you are authorized to access. Do not use exposed credentials, access another person's data, perform destructive provider operations or run denial-of-service tests. Production mutation requires separate, explicit owner authorization for the exact operation.
