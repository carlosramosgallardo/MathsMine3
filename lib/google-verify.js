// Shared with app/api/create-account and app/api/auth/session — verifies a
// Google OAuth access token server-side (unforgeable) and returns the
// opaque `sub` claim, never email/name (only the "openid" scope is used).
export async function verifyGoogleAccessToken(accessToken) {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!r.ok) return null;
    const { sub } = await r.json();
    return sub || null;
  } catch {
    return null;
  }
}
