type Platform = "ios" | "android" | "all";
type Options = {
  send: boolean;
  confirmAllUsers: boolean;
  allowProduction: boolean;
  help: boolean;
  platform: Platform;
  title: string;
  body: string;
};
type DeviceRow = { token: string; platform: "ios" | "android" };
type PushTicket = { status: string; details?: { error?: string } };

const usage = `Usage:
  pnpm run notifications:test
  pnpm run notifications:test -- --send --confirm-all-users
  pnpm run notifications:test -- --send --confirm-all-users --platform ios

The default is a dry run. Sending targets every recently active iOS/Android
installation with a registered Expo push token. Production also requires
--allow-production. Optional: --title "..." --body "...".`;

function parseOptions(args: string[]): Options {
  const options: Options = {
    send: false, confirmAllUsers: false, allowProduction: false, help: false,
    platform: "all",
    title: "Tagalong test notification",
    body: "This is a test notification. No action is needed.",
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--") continue;
    else if (arg === "--send") options.send = true;
    else if (arg === "--confirm-all-users") options.confirmAllUsers = true;
    else if (arg === "--allow-production") options.allowProduction = true;
    else if (arg === "--help" || arg === "-h") options.help = true;
    else if (arg === "--platform" || arg === "--title" || arg === "--body") {
      const value = args[++i];
      if (!value || value.startsWith("--")) throw new Error(`${arg} needs a value.`);
      if (arg === "--platform") {
        if (value !== "all" && value !== "ios" && value !== "android") throw new Error("--platform must be all, ios, or android.");
        options.platform = value;
      } else if (arg === "--title") options.title = value;
      else options.body = value;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }
  if (!options.title.trim() || options.title.length > 100) throw new Error("--title must be 1–100 characters.");
  if (!options.body.trim() || options.body.length > 280) throw new Error("--body must be 1–280 characters.");
  return options;
}

async function main() {
  let options: Options;
  try {
    options = parseOptions(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Invalid command options.");
    console.error(usage);
    process.exitCode = 2;
    return;
  }
  if (options.help) {
    console.log(usage);
    return;
  }
  if (options.send && !options.confirmAllUsers) {
    console.error("Refusing to send without --confirm-all-users. Run without --send first for a dry run.");
    process.exitCode = 2;
    return;
  }
  const isProduction = process.env.NODE_ENV === "production" || process.env.REPLIT_ENVIRONMENT === "production";
  if (options.send && isProduction && !options.allowProduction) {
    console.error("Refusing to broadcast in production without --allow-production.");
    process.exitCode = 2;
    return;
  }

  const { database } = await import("../src/db.js");
  try {
    const platformFilter = options.platform === "all" ? "" : "AND platform = ?";
    const sql = `SELECT DISTINCT push_token AS token, platform FROM installations
      WHERE push_token IS NOT NULL AND push_token != ''
      AND platform IN ('ios','android') ${platformFilter}
      ORDER BY platform`;
    const params = options.platform === "all"
      ? []
      : [options.platform];
    const devices = database.prepare(sql).all(...params) as DeviceRow[];
    console.log(`${options.send ? "Sending to" : "Dry run:"} ${devices.length} registered iOS/Android devices with push tokens.`);
    if (!options.send || !devices.length) {
      if (!devices.length) console.log("No registered devices match this selection.");
      else console.log("To send, add --send --confirm-all-users. Production also requires --allow-production.");
      return;
    }

    let accepted = 0;
    const errorCounts = new Map<string, number>();
    for (let offset = 0; offset < devices.length; offset += 100) {
      const batch = devices.slice(offset, offset + 100);
      const messages = batch.map(device => ({
        to: device.token,
        sound: "default",
        title: options.title,
        body: options.body,
        data: { kind: "safe-walk-test-notification" },
        channelId: "walks",
        priority: "high",
      }));
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(process.env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` } : {}),
        },
        body: JSON.stringify(messages),
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error(`Expo Push Service returned HTTP ${response.status}; no automatic retry was attempted.`);
      const payload = await response.json() as { data?: PushTicket[] };
      if (!Array.isArray(payload.data) || payload.data.length !== batch.length) {
        throw new Error("Expo returned an unexpected ticket count; no automatic retry was attempted.");
      }
      for (const ticket of payload.data) {
        if (ticket.status === "ok") accepted++;
        else {
          const code = ticket.details?.error ?? "UnknownTicketError";
          errorCounts.set(code, (errorCounts.get(code) ?? 0) + 1);
        }
      }
      console.log(`Processed batch ${Math.floor(offset / 100) + 1} (${batch.length} devices).`);
    }
    console.log(`Expo accepted ${accepted}/${devices.length} notifications. Acceptance is not confirmation of delivery.`);
    if (errorCounts.size) {
      console.error(`Ticket errors: ${[...errorCounts].map(([code, count]) => `${code}=${count}`).join(", ")}`);
      process.exitCode = 1;
    }
  } finally {
    database.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : "Notification test failed.");
  process.exitCode = 1;
});
