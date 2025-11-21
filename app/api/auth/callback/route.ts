import { type NextRequest, NextResponse } from "next/server";

/**
 * OAuth callback handler - routes to the appropriate provider
 * This endpoint is registered with Google, so it receives the OAuth response
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  
  console.log("🔀 OAuth callback hit at /api/auth/callback");
  console.log("Full URL:", url.toString());
  console.log("Query params:");
  for (const [key, value] of url.searchParams.entries()) {
    console.log(`  ${key}: ${value.substring(0, 50)}...`);
  }
  
  // Build the Google callback URL preserving ALL parameters including state and code
  const googleCallbackUrl = new URL(url.href.replace('/api/auth/callback', '/api/auth/callback/google'));
  
  console.log("Redirecting to:", googleCallbackUrl.toString().substring(0, 150) + "...");
  
  return NextResponse.redirect(googleCallbackUrl.toString());
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const googleCallbackPath = url.pathname.replace('/callback', '/callback/google');
  const redirectUrl = `${url.protocol}//${url.host}${googleCallbackPath}`;
  
  return NextResponse.redirect(redirectUrl, {
    status: 307, // Preserve POST method
  });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "*",
    },
  });
}
