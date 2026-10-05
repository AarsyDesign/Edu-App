# SECURITY-PRIVACY.md

## Principles

1. Child data minimization.
2. Parent-controlled identity.
3. Server-side authorization.
4. No public child profiles.
5. No child social interaction.
6. No advertising based on child behavior in MVP.
7. Secure session management.
8. Secrets never in client bundle.
9. Audit sensitive parent actions.
10. Content provenance must be preserved.

## Threats to Consider

- unauthorized access to child profile
- IDOR/BOLA
- leaked child analytics
- insecure parent gate
- malicious content injection
- prompt/content injection into AI pipeline
- AI-generated factual errors
- spam content
- XSS through content fields
- abusive uploaded media if later supported
- credential stuffing

## Required Controls

- schema validation
- output encoding
- authorization middleware
- rate limiting
- secure cookies/session strategy
- CSRF protection where applicable
- CSP where applicable
- database constraints
- audit logging
- backup and recovery
- content approval workflow
