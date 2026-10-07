import { createPrivateKey, sign } from "node:crypto";
import http2 from "node:http2";
import type { WidgetState } from "../../shared/contacts";

export const remoteWidgetsAvailable = () => !!(process.env.APNS_PRIVATE_KEY && process.env.APNS_KEY_ID && process.env.APNS_TEAM_ID);
let authorization: { jwt: string; expires: number } | undefined;
function jwt() {
  if (authorization && authorization.expires > Date.now()) return authorization.jwt;
  const header = Buffer.from(JSON.stringify({ alg: "ES256", kid: process.env.APNS_KEY_ID })).toString("base64url");
  const claims = Buffer.from(JSON.stringify({ iss: process.env.APNS_TEAM_ID, iat: Math.floor(Date.now() / 1000) })).toString("base64url");
  const input = `${header}.${claims}`;
  const signature = sign("sha256", Buffer.from(input), { key: createPrivateKey(process.env.APNS_PRIVATE_KEY!.replace(/\\n/g, "\n")), dsaEncoding: "ieee-p1363" });
  authorization = { jwt: `${input}.${signature.toString("base64url")}`, expires: Date.now() + 1500000 };
  return authorization.jwt;
}
export async function pushLiveActivity(token: string, event: "start" | "update" | "end", state: WidgetState) {
  if (!remoteWidgetsAvailable()) return false;
  const now = Math.floor(Date.now() / 1000);
  const aps: Record<string, unknown> = {
    timestamp: now, event, "content-state": { name: "SafeWalkTracking", props: JSON.stringify(state) },
    "stale-date": Math.min(Math.floor(state.expiresAt / 1000), now + 120),
  };
  if (event === "start") {
    aps["attributes-type"] = "LiveActivityAttributes"; aps.attributes = { url: `safewalk://track/${state.shareCode}` };
    aps.alert = { title: "Safe Walk tracking", body: "A contact shared a walk with you." };
    aps["input-push-token"] = 1;
  } else if (event === "end") aps["dismissal-date"] = now + 900;
  return new Promise<boolean>((resolve, reject) => {
    const client = http2.connect(process.env.APNS_SANDBOX === "false" ? "https://api.push.apple.com" : "https://api.sandbox.push.apple.com");
    const finish = (error?: Error) => { client.close(); error ? reject(error) : resolve(true); };
    client.on("error", finish);
    const req = client.request({
      ":method": "POST", ":path": `/3/device/${token}`, authorization: `bearer ${jwt()}`,
      "apns-topic": `${process.env.IOS_BUNDLE_IDENTIFIER ?? "app.safewalk.mobile"}.push-type.liveactivity`,
      "apns-push-type": "liveactivity", "apns-priority": event === "update" ? "5" : "10",
      "apns-expiration": String(event === "end" ? now + 900 : Math.floor(state.expiresAt / 1000)),
      "apns-collapse-id": `${event}-${state.shareCode}`.slice(0, 64),
    });
    let status = 0;
    req.on("response", headers => { status = Number(headers[":status"]); });
    req.on("data", () => {});
    req.on("error", finish);
    req.on("end", () => finish(status === 200 ? undefined : new Error(`APNs status ${status}`)));
    req.setTimeout(10000, () => { req.close(); finish(new Error("APNs timed out")); });
    req.end(JSON.stringify({ aps }));
  });
}
