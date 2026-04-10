# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| main    | Yes       |

## Reporting a Vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Email **akulahluwalia06@[your-domain]** with:
- Description of the vulnerability
- Steps to reproduce
- Potential impact

You will receive a response within 48 hours. If confirmed, a fix will be released as soon as possible.

## Security Practices

- All secrets (API keys, database URIs) are stored as environment variables — never in source code
- The backend applies rate limiting (100 req / 15 min per IP) via `express-rate-limit`
- HTTP headers hardened with `helmet`
- CORS restricted to the configured `CLIENT_ORIGIN`
- Input validation on all ticker parameters (alphanumeric, max 10 chars)
- MongoDB credentials URL-encoded; connection string never logged
- GitHub Actions workflows pin dependencies and use least-privilege permissions
