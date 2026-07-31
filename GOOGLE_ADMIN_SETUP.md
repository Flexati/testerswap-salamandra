# Google Admin SDK Setup — Google Group Membership Verification

## Overview

The `google.verifyMembership` tRPC procedure verifies if a user is a member of a Google Group by calling the Google Admin SDK Directory API.

## Prerequisites

1. **Google Workspace domain** (free Gmail accounts do not have Admin SDK access)
2. A **service account** with domain-wide delegation enabled
3. API scopes granted to the service account:
   - `https://www.googleapis.com/auth/admin.directory.group.member.readonly`
   - `https://www.googleapis.com/auth/admin.directory.group.readonly`

## Step-by-step

### 1. Create service account (Google Cloud Console)

1. Go to https://console.cloud.google.com/iam-admin/serviceaccounts
2. Select your project (or create one)
3. Click **Create service account**
4. Name: `testerswap-salamandra-admin`
5. Skip optional steps → **Done**
6. Click the created account → **Keys** → **Add key** → **Create new** → **JSON**
7. Save the JSON file securely

### 2. Enable domain-wide delegation

1. In the service account details page, click **Advanced settings** → **Edit**
2. Enable **Domain-wide delegation**
3. Note the **Client ID** (numeric)

### 3. Authorize API scopes (Google Workspace Admin Console)

1. Go to https://admin.google.com → **Security** → **API controls**
2. **Manage Domain Wide Delegation** → **Add new**
3. Enter the **Client ID** from step 2
4. Add OAuth scopes:
   - `https://www.googleapis.com/auth/admin.directory.group.member.readonly`
   - `https://www.googleapis.com/auth/admin.directory.group.readonly`
5. **Authorize**

### 4. Configure environment variables

In `.env` (production) and GitHub Actions secrets:

```bash
GOOGLE_SERVICE_ACCOUNT_EMAIL="testerswap-salamandra-admin@YOUR_PROJECT.iam.gserviceaccount.com"
GOOGLE_SERVICE_ACCOUNT_KEY="-----BEGIN PRIVATE KEY-----\nMIIE...\n-----END PRIVATE KEY-----\n"
GOOGLE_ADMIN_IMPERSONATE_USER="admin@your-domain.com"
```

For `GOOGLE_SERVICE_ACCOUNT_KEY`, use the `private_key` field from the JSON file, with newlines escaped as `\n`.

### 5. GitHub Actions secrets

Add the three variables above as repository secrets:
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SERVICE_ACCOUNT_KEY`
- `GOOGLE_ADMIN_IMPERSONATE_USER`

## Usage

From the client:

```ts
const result = await trpc.google.verifyMembership.mutate({
  groupEmail: "testers-12@googlegroups.com",
});
// → { isMember: true } or { isMember: false }
```

## Security notes

- **Scope is read-only** (`*.readonly`) — the service account cannot modify group membership.
- **Domain-wide delegation** is required because Admin SDK has no per-user OAuth flow that works for arbitrary domain users.
- **Google verification**: if your app grows to >100 users accessing Admin SDK, Google may require an OAuth verification audit (CASA Tier 2). Plan for this before public launch.
- **Email privacy**: do not log raw user emails. Log only hashed/truncated versions.

## Testing without real credentials

In dev/test, leaving the env vars empty causes `google.isConfigured` to return `false` and `verifyMembership` to return `{ isMember: false, error: "..." }`. The UI should handle this gracefully and fall back to "manual verification required".
