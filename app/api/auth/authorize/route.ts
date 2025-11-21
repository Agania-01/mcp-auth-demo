import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { OAuth21AuthParams } from "../../../../lib/auth-types";
import {
  CORS_CONFIGS,
  createOAuth21ErrorRedirect,
  createOPTIONSResponse,
  OAuthLogger,
  validateAuthParams,
} from "../../../../lib/oauth-utils";
import { resolveApiDomain } from "../../../../lib/url-resolver";

export async function OPTIONS() {
  return createOPTIONSResponse(CORS_CONFIGS.oauth);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;

  const authParams: OAuth21AuthParams = {
    response_type: searchParams.get("response_type"),
    client_id: searchParams.get("client_id"),
    redirect_uri: searchParams.get("redirect_uri"),
    scope: searchParams.get("scope"),
    state: searchParams.get("state"),
    code_challenge: searchParams.get("code_challenge"),
    code_challenge_method: searchParams.get("code_challenge_method"),
    resource: searchParams.get("resource"),
  };

  OAuthLogger.authRequest(authParams);
  const validation = validateAuthParams(authParams);
  if (!validation.isValid) {
    return createOAuth21ErrorRedirect(
      authParams.redirect_uri || null,
      validation.error || "invalid_request",
      validation.errorDescription || "Invalid authorization parameters",
      authParams.state || null,
    );
  }

  const {
    client_id: clientId,
    redirect_uri: redirectUri,
    scope,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
    resource,
  } = authParams;

  const baseUrl = resolveApiDomain();

  // Validate redirect URI patterns
  const validRedirectUris = [
    "http://127.0.0.1:3334/oauth/callback",
    "http://localhost:3334/oauth/callback",
    "http://127.0.0.1:33418/",
    "http://localhost:33418/",
    "http://localhost:3000/api/auth/callback",
    "http://127.0.0.1:3000/api/auth/callback",
  ];

  const vsCodePattern = /^http:\/\/127\.0\.0\.1:\d+\/$/;
  const vsCodeLocalhostPattern = /^http:\/\/localhost:\d+\/$/;
  const mcpRemotePattern =
    /^http:\/\/(127\.0\.0\.1|localhost):\d+\/oauth\/callback$/;
  const localDevPattern =
    /^http:\/\/(127\.0\.0\.1|localhost):\d+\/api\/auth\/callback$/;

  const isValidDynamicRedirect =
    redirectUri &&
    (vsCodePattern.test(redirectUri) ||
      vsCodeLocalhostPattern.test(redirectUri) ||
      mcpRemotePattern.test(redirectUri) ||
      localDevPattern.test(redirectUri) ||
      redirectUri.startsWith("vscode://") ||
      redirectUri.startsWith("vscode-insiders://"));

  if (
    !validRedirectUris.includes(redirectUri || "") &&
    !isValidDynamicRedirect
  ) {
    return createOAuth21ErrorRedirect(
      redirectUri || null,
      "invalid_request",
      "Invalid redirect_uri",
      state || null,
    );
  }

  // Generate authorization code
  const authCode = randomBytes(32).toString("base64url");

  // Store authorization code data
  if (!globalThis.authCodes) {
    globalThis.authCodes = new Map();
  }

  globalThis.authCodes.set(authCode, {
    clientId: clientId || "",
    redirectUri: redirectUri || "",
    scope: scope || "openid profile email mcp:read mcp:write",
    codeChallenge,
    codeChallengeMethod,
    resource,
    state: state || "",
    createdAt: Date.now(),
    expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
  });

  // Build Google OAuth URL
  const googleOAuthUrl = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  
  const redirectUriForGoogle = `${baseUrl}/api/auth/callback`;
  console.log("🔐 Building Google OAuth URL:");
  console.log("  baseUrl:", baseUrl);
  console.log("  redirect_uri:", redirectUriForGoogle);
  console.log("  client_id:", process.env.GOOGLE_CLIENT_ID ? "✓ set" : "✗ missing");
  
  googleOAuthUrl.searchParams.set(
    "client_id",
    process.env.GOOGLE_CLIENT_ID || "",
  );
  googleOAuthUrl.searchParams.set(
    "redirect_uri",
    redirectUriForGoogle,
  );
  googleOAuthUrl.searchParams.set("response_type", "code");
  googleOAuthUrl.searchParams.set("scope", "openid profile email");
  googleOAuthUrl.searchParams.set("access_type", "offline");
  googleOAuthUrl.searchParams.set("prompt", "consent");

  // Encode state with auth code for Google callback
  const encodedState = Buffer.from(
    JSON.stringify({
      authCode,
      originalState: state || "",
      originalRedirectUri: redirectUri || "",
      googleRedirectUri: redirectUriForGoogle, // The redirect_uri we sent to Google
      resource: resource || `${baseUrl}/api/mcp`,
    }),
  ).toString("base64url");

  googleOAuthUrl.searchParams.set("state", encodedState);

  console.log("✅ Redirecting to Google OAuth with URL:", googleOAuthUrl.toString().substring(0, 100) + "...");

  return NextResponse.redirect(googleOAuthUrl.toString());
}
