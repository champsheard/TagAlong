import { test } from "node:test";
import assert from "node:assert/strict";

test("Vercel verification uses direct Resend and Twilio credentials", async () => {
  const keys = [
    "VERCEL", "RESEND_API_KEY", "VERIFICATION_EMAIL_FROM",
    "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SMS_FROM",
  ] as const;
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  const originalFetch = globalThis.fetch;
  const requests: { url: string; init?: RequestInit }[] = [];
  Object.assign(process.env, {
    VERCEL: "1",
    RESEND_API_KEY: "test-resend-key",
    VERIFICATION_EMAIL_FROM: "Tagalong <verify@example.test>",
    TWILIO_ACCOUNT_SID: "AC00000000000000000000000000000000",
    TWILIO_AUTH_TOKEN: "test-twilio-auth",
    TWILIO_SMS_FROM: "+15555550100",
  });
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(input), init });
    return new Response(JSON.stringify({ id: "sent" }), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  try {
    const { verificationGateway } = await import("../src/verificationGateway");
    const capabilities = await verificationGateway.capabilities();
    assert.equal(capabilities.sms, true);
    assert.equal(capabilities.email, true);
    await verificationGateway.send("email", "walker@example.test", "123456");
    await verificationGateway.send("phone", "+15555550101", "654321");
    assert.equal(requests.length, 2);
    assert.equal(requests[0].url, "https://api.resend.com/emails");
    assert.match(String((requests[0].init?.headers as Record<string, string>).Authorization), /^Bearer /);
    assert.match(requests[1].url, /api\.twilio\.com\/2010-04-01\/Accounts\/AC/);
    assert.match(String((requests[1].init?.headers as Record<string, string>).Authorization), /^Basic /);
  } finally {
    globalThis.fetch = originalFetch;
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  }
});
