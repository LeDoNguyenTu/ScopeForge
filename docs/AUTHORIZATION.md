# Authorization Model

Workspace membership is the primary application authorization boundary.

Roles:

- owner - full workspace administration
- admin - membership and workspace management
- member - operational access added in later phases
- viewer - read-only access added in later phases

Database access policies are enforced in PostgreSQL with Row Level Security rather than relying only on frontend route checks.
