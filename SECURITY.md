# Security Notes

This is an academic demonstration project and uses synthetic data. It is not approved for use with real patient data or production hospital operations.

- Never commit `.env` or real database credentials.
- Copy `.env.example` to `.env` locally and set a unique, high-entropy `AUTH_SECRET`.
- Rotate any real credential that may have been exposed in a commit, archive, screenshot, or shared file.
- The seeded demo accounts use a shared demonstration password. Change/remove those accounts before any deployment beyond the local academic demo.
- Use TLS, managed secrets, hardened database accounts, backups, monitoring, and a formal security review before any real deployment.
