#!/usr/bin/env node

/**
 * MCP OAuth Proxy for Claude Desktop
 * 
 * This proxy server sits between Claude Desktop and your OAuth-protected MCP server.
 * It handles OAuth authentication and injects Bearer tokens into requests.
 * 
 * Usage:
 *   node mcp-oauth-proxy.js <remote-server-url> [local-port] [callback-port]
 * 
 * Example:
 *   node mcp-oauth-proxy.js https://mcp-auth-demo-green.vercel.app/api/mcp 3001 59908
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const REMOTE_SERVER = process.argv[2] || 'https://mcp-auth-demo-green.vercel.app/api/mcp';
const LOCAL_PORT = process.argv[3] || 3001;
const CALLBACK_PORT = process.argv[4] || 59908;
const BASE_URL = REMOTE_SERVER.replace(/\/api\/mcp.*$/, '');

// Token cache
let cachedToken = null;
let tokenExpiry = null;

function log(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

async function getAuthToken() {
  // Check if cached token is still valid (with 5 min buffer)
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry - 300000) {
    return cachedToken;
  }

  log('🔐 Starting OAuth authentication flow...');

  return new Promise((resolve, reject) => {
    let resolved = false;
    
    const server = http.createServer(async (req, res) => {
      if (resolved) return;

      const url = new URL(req.url, `http://localhost:${CALLBACK_PORT}`);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');

      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<h1>❌ Authentication Failed</h1><p>Error: ${error}</p><p>${url.searchParams.get('error_description') || ''}</p>`);
        server.close();
        resolved = true;
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (code) {
        log('📝 Exchanging authorization code for token...');
        
        try {
          const tokenUrl = `${BASE_URL}/api/auth/token`;
          const body = new URLSearchParams({
            grant_type: 'authorization_code',
            code: code,
            redirect_uri: `http://localhost:${CALLBACK_PORT}/callback`,
            client_id: 'claude-desktop-mcp',
          });

          const response = await fetch(tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString()
          });

          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
          }

          const data = await response.json();
          
          if (!data.id_token) {
            throw new Error('No id_token in response');
          }

          cachedToken = data.id_token;
          tokenExpiry = Date.now() + ((data.expires_in || 3600) * 1000);
          
          log('✅ Authentication successful!');
          
          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(`
            <html>
              <head><title>Authentication Successful</title></head>
              <body style="font-family: system-ui; max-width: 600px; margin: 50px auto; padding: 20px;">
                <h1 style="color: green;">✅ Authentication Successful!</h1>
                <p>You can now close this window and use Claude Desktop.</p>
                <p style="color: #666; font-size: 14px;">Token expires in ${Math.floor((data.expires_in || 3600) / 60)} minutes.</p>
              </body>
            </html>
          `);
          
          server.close();
          resolved = true;
          resolve(cachedToken);
        } catch (error) {
          log(`❌ Token exchange error: ${error.message}`);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(`<h1>Token Exchange Failed</h1><p>${error.message}</p>`);
          server.close();
          resolved = true;
          reject(error);
        }
      }
    });

    server.on('error', (error) => {
      if (!resolved) {
        resolved = true;
        reject(error);
      }
    });

    server.listen(CALLBACK_PORT, () => {
      const authUrl = `${BASE_URL}/api/auth/authorize?` +
        `response_type=code&` +
        `redirect_uri=${encodeURIComponent(`http://localhost:${CALLBACK_PORT}/callback`)}&` +
        `state=claude-desktop&` +
        `client_id=claude-desktop-mcp`;

      log(`🌐 Opening browser for authentication...`);
      log(`   Visit: ${authUrl}`);
      
      // Open browser
      const { exec } = require('child_process');
      const command = process.platform === 'win32' 
        ? `start "" "${authUrl}"`
        : process.platform === 'darwin'
          ? `open "${authUrl}"`
          : `xdg-open "${authUrl}"`;
      
      exec(command, (error) => {
        if (error) {
          log(`⚠️  Could not open browser. Please visit the URL above manually.`);
        }
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      if (!resolved) {
        server.close();
        resolved = true;
        reject(new Error('Authentication timeout - please try again'));
      }
    }, 300000);
  });
}

async function proxyRequest(clientReq, clientRes) {
  try {
    // Ensure we have a valid token
    const token = await getAuthToken();

    // Read the request body
    let body = '';
    clientReq.on('data', chunk => body += chunk);
    
    await new Promise(resolve => clientReq.on('end', resolve));

    // Parse remote URL
    const remoteUrl = new URL(REMOTE_SERVER);
    
    // Forward request to remote server with Bearer token
    const options = {
      hostname: remoteUrl.hostname,
      port: remoteUrl.port || (remoteUrl.protocol === 'https:' ? 443 : 80),
      path: remoteUrl.pathname + remoteUrl.search,
      method: clientReq.method,
      headers: {
        ...clientReq.headers,
        'Authorization': `Bearer ${token}`,
        'Host': remoteUrl.host,
      }
    };

    log(`📤 Proxying ${clientReq.method} request to ${REMOTE_SERVER}`);

    const protocol = remoteUrl.protocol === 'https:' ? https : http;
    
    const remoteReq = protocol.request(options, (remoteRes) => {
      log(`📥 Response status: ${remoteRes.statusCode}`);
      
      // Forward response headers
      clientRes.writeHead(remoteRes.statusCode, remoteRes.headers);
      
      // Forward response body
      remoteRes.pipe(clientRes);
    });

    remoteReq.on('error', (error) => {
      log(`❌ Proxy error: ${error.message}`);
      clientRes.writeHead(502, { 'Content-Type': 'application/json' });
      clientRes.end(JSON.stringify({ error: 'proxy_error', message: error.message }));
    });

    // Send request body
    if (body) {
      remoteReq.write(body);
    }
    remoteReq.end();

  } catch (error) {
    log(`❌ Error: ${error.message}`);
    clientRes.writeHead(500, { 'Content-Type': 'application/json' });
    clientRes.end(JSON.stringify({ error: 'auth_error', message: error.message }));
  }
}

// Create proxy server
const proxyServer = http.createServer((req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  proxyRequest(req, res);
});

proxyServer.listen(LOCAL_PORT, async () => {
  log('🚀 MCP OAuth Proxy Server Started');
  log(`   Local endpoint: http://localhost:${LOCAL_PORT}/mcp`);
  log(`   Remote server: ${REMOTE_SERVER}`);
  log(`   Callback port: ${CALLBACK_PORT}`);
  log('');
  log('📋 Configure Claude Desktop with:');
  log(`   {
     "mcpServers": {
       "mcp-auth-demo": {
         "command": "npx",
         "args": ["-y", "mcp-remote", "http://localhost:${LOCAL_PORT}/mcp"]
       }
     }
   }`);
  log('');
  
  // Pre-authenticate to get token
  try {
    await getAuthToken();
    log('✅ Ready to proxy requests!');
  } catch (error) {
    log(`⚠️  Pre-authentication failed: ${error.message}`);
    log('   Will retry when first request comes in...');
  }
});

proxyServer.on('error', (error) => {
  log(`❌ Proxy server error: ${error.message}`);
  process.exit(1);
});
