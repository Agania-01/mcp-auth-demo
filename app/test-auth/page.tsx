"use client";

export default function TestAuthPage() {
  const handleSignIn = () => {
    const port = window.location.port || "3001";
    const authUrl = new URL(`http://localhost:${port}/api/auth/authorize`);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", `http://localhost:${port}/api/auth/callback`);
    authUrl.searchParams.set("scope", "openid profile email");
    
    console.log("Starting OAuth flow:", authUrl.toString());
    window.location.href = authUrl.toString();
  };

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-8">OAuth 2.0/2.1 Test</h1>
        <button
          onClick={handleSignIn}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg"
        >
          Sign in with Google
        </button>
        <p className="mt-4 text-sm text-gray-500">
          Running on port: {typeof window !== "undefined" ? window.location.port || "3001" : "3001"}
        </p>
      </div>
    </div>
  );
}
