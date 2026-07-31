interface AdminConfig {
  serviceAccountEmail: string;
  serviceAccountKey: string;
  impersonateUser: string;
}

let cachedClient: any = null;

function getAdminConfig(): AdminConfig | null {
  const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const impersonateUser = process.env.GOOGLE_ADMIN_IMPERSONATE_USER;
  if (!serviceAccountEmail || !serviceAccountKey || !impersonateUser) {
    return null;
  }
  return { serviceAccountEmail, serviceAccountKey, impersonateUser };
}

/**
 * Lazily loads the `googleapis` package via dynamic import.
 * Returns null when the package is not installed (e.g., in tests where Admin SDK is unused).
 */
async function loadGoogleApis(): Promise<any | null> {
  try {
    const specifier = "google" + "apis";
    const mod: any = await import(/* @vite-ignore */ specifier);
    return mod;
  } catch {
    return null;
  }
}

async function getAdminClient(): Promise<any> {
  const config = getAdminConfig();
  if (!config) {
    throw new Error(
      "Google Admin SDK not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_SERVICE_ACCOUNT_KEY, GOOGLE_ADMIN_IMPERSONATE_USER.",
    );
  }
  const googleapis = await loadGoogleApis();
  if (!googleapis) {
    throw new Error(
      "googleapis package not installed. Run: pnpm add googleapis@^144.0.0",
    );
  }
  const auth = new googleapis.google.auth.JWT({
    email: config.serviceAccountEmail,
    key: config.serviceAccountKey.replace(/\\n/g, "\n"),
    scopes: [
      "https://www.googleapis.com/auth/admin.directory.group.member.readonly",
      "https://www.googleapis.com/auth/admin.directory.group.readonly",
    ],
    subject: config.impersonateUser,
  });
  return googleapis.google.admin({ version: "directory_v1", auth });
}

export async function isUserInGoogleGroup(
  userEmail: string,
  groupEmail: string,
): Promise<boolean> {
  if (!getAdminConfig()) {
    throw new Error("Google Admin SDK not configured");
  }
  const admin = cachedClient ?? (await getAdminClient());
  cachedClient = admin;
  try {
    const res = await admin.members.hasMember({
      groupKey: groupEmail,
      memberKey: userEmail,
    });
    return res.data.isMember === true;
  } catch (err: any) {
    if (err?.code === 404 || err?.status === 404) {
      return false;
    }
    throw err;
  }
}

export async function listGroupMembers(groupEmail: string): Promise<string[]> {
  if (!getAdminConfig()) {
    throw new Error("Google Admin SDK not configured");
  }
  const admin = cachedClient ?? (await getAdminClient());
  cachedClient = admin;
  const res = await admin.members.list({ groupKey: groupEmail });
  return (res.data.members ?? [])
    .map((m: any) => m.email ?? "")
    .filter(Boolean);
}

export function isAdminSdkConfigured(): boolean {
  return getAdminConfig() !== null;
}
