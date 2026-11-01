import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const PRODUCTION_CALLBACK_URL = "https://poker-tournament-management.onrender.com/auth/google/callback";
const DEV_CALLBACK_URL = `http://localhost:${process.env.PORT || 4000}/auth/google/callback`;

// GOOGLE_CALLBACK_URL always wins when set explicitly. Otherwise, never fall
// back to localhost in production — that silently breaks the OAuth redirect
// on Render if the env var is ever missing.
const GOOGLE_CALLBACK_URL =
  process.env.GOOGLE_CALLBACK_URL ||
  (process.env.NODE_ENV === "production" ? PRODUCTION_CALLBACK_URL : DEV_CALLBACK_URL);

export const isGoogleAuthConfigured = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);

const client = isGoogleAuthConfigured
  ? new OAuth2Client(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_CALLBACK_URL)
  : null;

export function getGoogleAuthUrl() {
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    prompt: "select_account",
  });
}

// Exchanges an authorization code for a verified Google identity. Verifying
// the ID token (rather than trusting the decoded payload outright) confirms
// it was actually issued by Google for our client ID.
export async function getGoogleProfile(code) {
  const { tokens } = await client.getToken(code);
  const ticket = await client.verifyIdToken({
    idToken: tokens.id_token,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  return {
    googleId: payload.sub,
    email: payload.email,
    displayName: payload.name,
  };
}
