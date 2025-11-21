# OAuth Playbook: MCP Authentication Demo

**📋 Week 7 Deliverable - OAuth-Secured MCP Hello Server**

---

## 🎯 Project Overview

This is an OAuth 2.1 compliant MCP (Model Context Protocol) server that implements secure authentication using Google OAuth. The server provides a simple "Say Hello" tool that demonstrates authenticated MCP operations.

**Live Deployment:** https://mcp-auth-demo-green.vercel.app  
**GitHub Repository:** https://github.com/Agania-01/mcp-auth-demo

---

## ✅ Deliverable Checklist

- ✅ **GitHub Repository:** Customized mcp-auth-demo with OAuth 2.1 implementation
- ✅ **Deployment URL:** Working OAuth flow on Vercel (https://mcp-auth-demo-green.vercel.app)
- ✅ **Client Setup Documentation:** This playbook describes setup for VS Code and Claude Desktop
- ✅ **Screenshots:** Authenticated sessions included in repository
- ✅ **Security Notes:** Token storage, scopes, and revocation documented

---

## 🏗️ Architecture

### OAuth 2.1 Flow

```
┌─────────────┐         ┌──────────────┐         ┌─────────────┐
│   Client    │         │  MCP Server  │         │   Google    │
│ (VS Code /  │         │   (Vercel)   │         │   OAuth     │
│   Claude)   │         │              │         │             │
└──────┬──────┘         └──────┬───────┘         └──────┬──────┘
       │                       │                        │
       │  1. Request MCP Tool  │                        │
       ├──────────────────────>│                        │
       │                       │                        │
       │  2. 401 Unauthorized  │                        │
       │     + WWW-Authenticate│                        │
       │<──────────────────────┤                        │
       │                       │                        │
       │  3. Discover OAuth    │                        │
       │     (/.well-known/)   │                        │
       ├──────────────────────>│                        │
       │                       │                        │
       │  4. Redirect to Auth  │                        │
       │<──────────────────────┤                        │
       │                       │                        │
       │  5. User authenticates│                        │
       ├───────────────────────┼───────────────────────>│
       │                       │                        │
       │  6. Authorization Code│                        │
       │<──────────────────────┼────────────────────────┤
       │                       │                        │
       │  7. Exchange for Token│                        │
       ├──────────────────────>│                        │
       │                       │  8. Verify Token       │
       │                       ├───────────────────────>│
       │                       │                        │
       │                       │  9. User Info          │
       │                       │<───────────────────────┤
       │                       │                        │
       │  10. MCP Tool Response│                        │
       │     + User Context    │                        │
       │<──────────────────────┤                        │
```

### Key Components

1. **Authorization Server Metadata** (`/.well-known/oauth-authorization-server`)
   - Provides OAuth 2.1 capability discovery
   - Lists supported flows, endpoints, and methods

2. **Protected Resource Metadata** (`/.well-known/oauth-protected-resource`)
   - Declares authentication requirements
   - Points to authorization servers

3. **OAuth Endpoints:**
   - `/api/auth/authorize` - Authorization endpoint
   - `/api/auth/token` - Token exchange endpoint
   - `/api/auth/callback/google` - Google OAuth callback
   - `/api/auth/register` - Dynamic client registration (RFC 7591)

4. **MCP Endpoint:**
   - `/api/mcp` - Protected MCP server (requires Bearer token)
   - `/api/mcp-public` - Public endpoint (no authentication)

---

## 🔧 Client Setup Guide

### Option 1: VS Code MCP Extension (Recommended)

The VS Code MCP extension has built-in OAuth support and handles authentication automatically.

#### Setup Steps:

1. **Install VS Code MCP Extension**
   - Search for "MCP" in VS Code extensions
   - Install the official Model Context Protocol extension

2. **Configure MCP Server**
   
   Create or edit `.vscode/mcp.json`:
   ```json
   {
     "servers": {
       "mcp-auth-demo": {
         "type": "http",
         "url": "https://mcp-auth-demo-green.vercel.app/api/mcp"
       }
     }
   }
   ```

3. **Start Server & Authenticate**
   - Open MCP panel in VS Code
   - Click "Start" on the `mcp-auth-demo` server
   - Browser will open for Google authentication
   - Sign in with your Google account
   - Authorize the application
   - Return to VS Code - server is now authenticated!

4. **Use MCP Tools**
   - Call `say_hello` tool with your name
   - Response includes your authenticated user info

#### Screenshots:
- ✅ VS Code MCP configuration (`.vscode/mcp.json`)
- ✅ Authenticated session showing user context

---

### Option 2: Claude Desktop with OAuth Proxy

Claude Desktop doesn't natively support OAuth, so we use a local proxy server that handles authentication.

#### Setup Steps:

1. **Add Google OAuth Redirect URI**
   
   In Google Cloud Console:
   - Go to APIs & Credentials → OAuth 2.0 Client IDs
   - Add authorized redirect URI: `http://localhost:59908/callback`
   - Save changes

2. **Start OAuth Proxy**
   
   ```bash
   node mcp-oauth-proxy.js https://mcp-auth-demo-green.vercel.app/api/mcp 3002 59908
   ```
   
   Parameters:
   - First: Remote MCP server URL
   - Second: Local proxy port (default: 3002)
   - Third: OAuth callback port (default: 59908)

3. **Authenticate**
   - Browser opens automatically
   - Sign in with Google
   - Authorize the application
   - See "Authentication Successful" message
   - Proxy is now ready with cached token

4. **Configure Claude Desktop**
   
   Edit `%APPDATA%\Claude\claude_desktop_config.json`:
   ```json
   {
     "mcpServers": {
       "mcp-auth-demo": {
         "command": "npx",
         "args": [
           "-y",
           "mcp-remote",
           "http://localhost:3002/mcp"
         ]
       }
     }
   }
   ```

5. **Restart Claude Desktop**
   - Close and reopen Claude Desktop
   - MCP server will connect through proxy
   - All requests include OAuth Bearer token

#### How the Proxy Works:
- Runs locally on your machine
- Handles OAuth flow automatically
- Caches tokens for 1 hour
- Injects `Authorization: Bearer <token>` in all requests
- Forwards requests to Vercel deployment
- No token exposure to Claude AI

#### Screenshots:
- ✅ Claude Desktop config (`claude_desktop_config.json`)
- ✅ OAuth success page with token information
- ✅ Proxy server running in terminal

---

### Option 3: Direct Connection (Public Endpoint - Testing Only)

For quick testing without OAuth:

```json
{
  "mcpServers": {
    "mcp-auth-demo-public": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://mcp-auth-demo-green.vercel.app/api/mcp-public/sse"
      ]
    }
  }
}
```

⚠️ **Not recommended for production** - no authentication.

---

## 🔒 Security Documentation

### Token Storage

#### VS Code MCP Extension
- Tokens stored in VS Code's secure credential storage
- Encrypted using OS-level credential managers:
  - **Windows:** Windows Credential Manager
  - **macOS:** Keychain
  - **Linux:** Secret Service API/libsecret
- Tokens never written to disk in plain text
- Automatic token refresh before expiration

#### OAuth Proxy (Claude Desktop)
- Tokens cached **in memory only**
- No disk persistence (enhances security)
- Token cleared on proxy restart
- 5-minute buffer before expiration for auto-refresh
- Proxy runs locally - no external token exposure

#### Google ID Tokens
- Signed JWT tokens from Google
- Verified using Google's public keys
- Short-lived: **1 hour expiration**
- Contains user claims: email, name, picture
- Verified on every MCP request

### OAuth Scopes

The application requests minimal scopes:

```javascript
scopes: [
  "openid",                                    // OpenID Connect
  "https://www.googleapis.com/auth/userinfo.email",    // Email address
  "https://www.googleapis.com/auth/userinfo.profile"   // Basic profile
]
```

**Why these scopes:**
- `openid` - Required for ID token issuance
- `userinfo.email` - User identification and context
- `userinfo.profile` - Display name and avatar

**Not requested:**
- ❌ Drive access
- ❌ Gmail access  
- ❌ Calendar access
- ❌ Any write permissions

### Token Validation

Every MCP request validates the Bearer token:

1. **Signature Verification**
   - Fetches Google's public keys (JWKs)
   - Verifies JWT signature cryptographically
   - Ensures token issued by Google

2. **Audience Validation**
   - Checks `aud` claim matches client ID
   - Prevents token reuse from other applications

3. **Expiration Check**
   - Verifies `exp` claim (expiration timestamp)
   - Rejects expired tokens automatically

4. **Issuer Validation**
   - Confirms `iss` claim is Google
   - Prevents forged tokens

### Token Revocation

#### User-Initiated Revocation
Users can revoke access at any time:

1. Visit Google Account Settings: https://myaccount.google.com/permissions
2. Find "MCP Authentication Demo"
3. Click "Remove Access"
4. All tokens immediately invalidated

#### Automatic Expiration
- **ID Tokens:** 1 hour lifetime
- **Refresh Tokens:** Available if offline access granted
- **Session:** Tied to Google account session

#### Server-Side Revocation
The server validates tokens on every request, so:
- Revoked tokens rejected immediately
- No server-side token storage needed
- Stateless authentication

### Security Best Practices Implemented

✅ **OAuth 2.1 Compliance**
- Authorization code flow only (no implicit flow)
- PKCE support for public clients
- No tokens in URL fragments

✅ **HTTPS Only**
- All production endpoints use HTTPS
- Prevents token interception
- Secure cookie transmission

✅ **State Parameter**
- CSRF protection in OAuth flow
- Random state generation
- State validation on callback

✅ **Minimal Permissions**
- Least privilege principle
- Only essential scopes requested
- No unnecessary data access

✅ **Token Validation**
- Every request verified
- Cryptographic signature checking
- Audience and issuer validation

✅ **Error Handling**
- No sensitive data in error messages
- Proper HTTP status codes
- OAuth 2.1 compliant error responses

### Threat Model & Mitigations

| Threat | Mitigation |
|--------|-----------|
| Token theft via MITM | HTTPS enforced, no HTTP fallback |
| Token theft via XSS | Tokens never in localStorage/cookies |
| CSRF attacks | State parameter validation |
| Token replay | Short expiration, audience validation |
| Phishing attacks | Google's OAuth consent screen |
| Unauthorized access | Token validation on every request |

---

## 🧪 Testing the OAuth Flow

### End-to-End Test (VS Code)

1. **Start fresh** (clear any cached credentials)
2. Configure `.vscode/mcp.json` with production URL
3. Click "Start" on MCP server
4. **Verify:** Browser opens to Google OAuth
5. **Verify:** Google consent screen shows correct scopes
6. **Verify:** Redirect back to localhost
7. **Verify:** VS Code shows "Connected" status
8. Call `say_hello` tool
9. **Verify:** Response includes your authenticated email

### End-to-End Test (Claude Desktop)

1. Start OAuth proxy: `node mcp-oauth-proxy.js https://mcp-auth-demo-green.vercel.app/api/mcp 3002 59908`
2. **Verify:** Browser opens for authentication
3. Complete Google sign-in
4. **Verify:** "Authentication Successful" page
5. **Verify:** Proxy logs "✅ Ready to proxy requests!"
6. Configure Claude Desktop with `http://localhost:3002/mcp`
7. Restart Claude Desktop
8. **Verify:** MCP server appears in Claude
9. Ask Claude to use `say_hello` tool
10. **Verify:** Response includes authenticated user info

### Unauthenticated Request Test

Test that security is working:

```bash
# Should return 401 Unauthorized
curl -X POST https://mcp-auth-demo-green.vercel.app/api/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"tools/list","id":1}'
```

Expected response:
```json
{
  "error": "unauthorized",
  "message": "Bearer token required"
}
```

With `WWW-Authenticate` header pointing to `.well-known/oauth-protected-resource`.

---

## 📊 Deliverable Artifacts

### 1. GitHub Repository
- **URL:** https://github.com/Agania-01/mcp-auth-demo
- **Branch:** main
- **Commit:** Latest with OAuth 2.1 implementation

### 2. Live Deployment
- **Production URL:** https://mcp-auth-demo-green.vercel.app
- **Status:** ✅ Active and deployed
- **Health Check:** https://mcp-auth-demo-green.vercel.app/.well-known/oauth-authorization-server

### 3. Documentation Files
- ✅ `/oauth-playbook` - This comprehensive guide
- ✅ `README.md` - Project overview and quick start
- ✅ `docs/authentication-url-patterns.md` - OAuth flow analysis
- ✅ `docs/oauth-2.1-compliance-plan.md` - Compliance implementation
- ✅ `agents.md` - Development guidelines

### 4. Screenshots Included

All screenshots demonstrate working OAuth flows:

1. **Google OAuth Client Configuration**
   - Shows OAuth 2.0 Client ID "Say Hello"
   - Client ID: 550417853325-p0be...
   - Web application type

2. **OAuth Success Page**
   - URL shows successful callback
   - Token information displayed (ID token, access token)
   - Expiration: 3599 seconds
   - Scopes: openid, email, profile
   - Refresh token present

3. **Vercel Deployment**
   - Production deployment active
   - Domain: mcp-auth-demo-green.vercel.app
   - Status: Ready
   - Deployment by Agania-01

4. **VS Code MCP Configuration**
   - `.vscode/mcp.json` configured
   - Both production and local endpoints
   - Proper JSON structure

5. **Claude Desktop Configuration**
   - `claude_desktop_config.json` shown
   - Proxy configuration with mcp-remote
   - Port 3002 local proxy endpoint

### 5. Security Documentation
- Token storage mechanisms documented
- OAuth scopes justified and minimal
- Revocation procedures explained
- Threat model with mitigations
- Validation processes described

---

## 🎓 Learning Outcomes

This project demonstrates:

✅ **OAuth 2.1 Implementation**
- Authorization code flow with PKCE
- Token validation and verification
- Dynamic client registration

✅ **MCP Protocol Integration**
- HTTP transport with authentication
- Tool registration and execution
- Error handling and compliance

✅ **Security Best Practices**
- Minimal privilege scopes
- Token lifecycle management
- Secure credential storage
- HTTPS enforcement

✅ **Production Deployment**
- Vercel deployment pipeline
- Environment variable management
- Multi-client support (VS Code, Claude Desktop)

✅ **Documentation**
- End-to-end setup guides
- Architecture diagrams
- Security analysis
- Testing procedures

---

## 🔗 Additional Resources

- **OAuth 2.1 Specification:** https://datatracker.ietf.org/doc/html/draft-ietf-oauth-v2-1
- **MCP Specification:** https://modelcontextprotocol.io
- **Google OAuth Documentation:** https://developers.google.com/identity/protocols/oauth2
- **RFC 7591 (Dynamic Registration):** https://datatracker.ietf.org/doc/html/rfc7591
- **RFC 8414 (Authorization Server Metadata):** https://datatracker.ietf.org/doc/html/rfc8414
- **RFC 9728 (Protected Resource Metadata):** https://datatracker.ietf.org/doc/html/rfc9728

---

## 📝 Conclusion

This OAuth-secured MCP Hello Server demonstrates a production-ready implementation of authenticated Model Context Protocol services. The system successfully:

- ✅ Implements OAuth 2.1 authorization code flow
- ✅ Integrates with Google as identity provider
- ✅ Supports multiple client types (VS Code, Claude Desktop)
- ✅ Follows security best practices
- ✅ Provides comprehensive documentation
- ✅ Deploys to production (Vercel)

The playbook provides complete setup instructions for both VS Code and Claude Desktop clients, along with detailed security analysis covering token storage, scopes, and revocation procedures.

**Project Status:** ✅ Complete and production-ready

---

**Author:** Agania-01  
**Course:** Week 7 - OAuth-Secured MCP Implementation  
**Date:** November 21, 2025  
**Repository:** https://github.com/Agania-01/mcp-auth-demo  
**Deployment:** https://mcp-auth-demo-green.vercel.app
