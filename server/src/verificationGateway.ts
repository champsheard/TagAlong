import { ReplitConnectors } from "@replit/connectors-sdk";
import { HttpError } from "./errors";
import type { IdentifierKind } from "../../shared/contacts";

const connectors = new ReplitConnectors();
let capabilitiesCache: { at: number; sms: boolean; email: boolean } | undefined;
async function capabilities() {
  if (capabilitiesCache && Date.now() - capabilitiesCache.at < 10000) return capabilitiesCache;
  try {
    const connections = await Promise.race([
      connectors.listConnections(),
      new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error("Integration status timed out")), 4000); t.unref(); }),
    ]);
    capabilitiesCache = {
      at: Date.now(),
      sms: connections.some(c => c.connector_name === "twilio"),
      email: connections.some(c => c.connector_name === "resend") && !!process.env.VERIFICATION_EMAIL_FROM,
    };
  } catch { capabilitiesCache = { at: Date.now(), sms: false, email: false }; }
  return capabilitiesCache;
}
let senderCache: { at: number; account: string; from: string } | undefined;
async function smsSender() {
  if (senderCache && Date.now() - senderCache.at < 1800000) return senderCache;
  const accountsResponse = await connectors.proxy("twilio", "/2010-04-01/Accounts.json?PageSize=1");
  if (!accountsResponse.ok) throw new HttpError(503, "SMS verification could not connect to Twilio. Reconnect the integration.");
  const accounts = await accountsResponse.json() as { accounts?: { sid: string }[] };
  const account = accounts.accounts?.[0]?.sid;
  if (!account || !/^AC[a-f0-9]{32}$/i.test(account)) throw new HttpError(503, "Twilio did not return an SMS account.");
  let from = process.env.TWILIO_SMS_FROM;
  if (!from) {
    const response = await connectors.proxy("twilio", `/2010-04-01/Accounts/${account}/IncomingPhoneNumbers.json?PageSize=20`);
    if (response.ok) {
      const numbers = await response.json() as { incoming_phone_numbers?: { phone_number: string; capabilities?: { sms: boolean } }[] };
      from = numbers.incoming_phone_numbers?.find(n => n.capabilities?.sms)?.phone_number;
    }
  }
  if (!from) throw new HttpError(503, "Twilio needs an SMS-enabled sender. Configure TWILIO_SMS_FROM or add a sender in Twilio.");
  return senderCache = { at: Date.now(), account, from };
}
async function send(kind: IdentifierKind, destination: string, code: string) {
  const available = await capabilities();
  if (kind === "phone") {
    if (!available.sms) throw new HttpError(503, "Phone verification needs the Twilio integration. Link sharing still works without verification.");
    const sender = await smsSender();
    const response = await connectors.proxy("twilio", `/2010-04-01/Accounts/${sender.account}/Messages.json`, {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: destination, From: sender.from, Body: `Your Tagalong verification code is ${code}. It expires in 10 minutes. Do not share this code.` }),
    });
    if (!response.ok) throw new HttpError(503, "Twilio could not send this code. Check the sender, recipient eligibility, and account balance.");
  } else {
    if (!available.email) throw new HttpError(503, "Email verification needs Resend and a verified VERIFICATION_EMAIL_FROM sender. Link sharing still works.");
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST", body: { from: process.env.VERIFICATION_EMAIL_FROM, to: [destination],
        subject: "Your Tagalong verification code", text: `Your Tagalong code is ${code}. It expires in 10 minutes. Do not share it. If you didn't request this code, you can ignore this message.` },
    });
    if (!response.ok) throw new HttpError(503, "Resend could not send this code. Check the verified sender and email integration.");
  }
}
// A narrow adapter also permits deterministic tests without sending real codes.
export const verificationGateway = { capabilities, send };
