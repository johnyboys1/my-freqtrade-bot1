// Helper function for Discord security verification
function hexToUint8Array(hex) {
  return new Uint8Array(hex.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
}

async function verifyDiscordRequest(request, publicKey) {
  const signature = request.headers.get('x-signature-ed25519');
  const timestamp = request.headers.get('x-signature-timestamp');
  if (!signature || !timestamp) return false;

  const body = await request.clone().text();
  const encoder = new TextEncoder();
  
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(publicKey),
      { name: 'NODE-ED25519', namedCurve: 'NODE-ED25519' },
      false,
      ['verify']
    );
    return await crypto.subtle.verify(
      'NODE-ED25519',
      key,
      hexToUint8Array(signature),
      encoder.encode(timestamp + body)
    );
  } catch (err) {
    return false;
  }
}

export default {
  async fetch(request, env, ctx) {
    // ==========================================
    // PASTE YOUR CREDENTIALS HERE
    // ==========================================
    const DISCORD_PUBLIC_KEY = "PASTE_PUBLIC_KEY_HERE";
    const DISCORD_APP_ID = "PASTE_APPLICATION_ID_HERE";
    const DISCORD_BOT_TOKEN = "PASTE_BOT_TOKEN_HERE";
    const MAKE_WEBHOOK_URL = "https://hook.eu1.make.com/klwlgk42i71ae4ugloiqmqflcgy8kqmw";

    const url = new URL(request.url);

    // ==========================================
    // AUTO-REGISTER COMMAND
    // ==========================================
    if (request.method === 'GET' && url.pathname === '/register') {
      const response = await fetch(`https://discord.com/api/v10/applications/${DISCORD_APP_ID}/commands`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${DISCORD_BOT_TOKEN}`
        },
        body: JSON.stringify({
          name: 'audit',
          description: 'Instant AI audit of a Solana token',
          options: [{
            name: 'address',
            description: 'The Solana contract address',
            type: 3, // String type
            required: true
          }]
        })
      });
      const result = await response.json();
      return new Response(JSON.stringify({ success: true, discord_response: result }), { headers: { 'Content-Type': 'application/json' } });
    }

    // ==========================================
    // DISCORD WEBHOOK LOGIC
    // ==========================================
    if (request.method !== 'POST') {
      return new Response('Worker is running. Add /register to the URL to build the command.', { status: 200 });
    }

    const isValid = await verifyDiscordRequest(request, DISCORD_PUBLIC_KEY);
    if (!isValid) {
      return new Response('Invalid signature', { status: 401 });
    }

    const body = await request.json();

    // 1. Initial Discord handshake
    if (body.type === 1) {
      return new Response(JSON.stringify({ type: 1 }), { headers: { 'Content-Type': 'application/json' } });
    }

    // 2. Someone typed /audit
    if (body.type === 2) {
      const address = body.data.options[0].value;

      // Fire Make.com webhook secretly in the background
      ctx.waitUntil(fetch(MAKE_WEBHOOK_URL + "?address=" + address, { method: "GET" }));

      // Immediately respond in Discord so it doesn't fail
      return new Response(JSON.stringify({
        type: 4,
        data: { content: `🔍 Auditing token \`${address}\`... generating report.` }
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Unknown', { status: 400 });
  }
};
