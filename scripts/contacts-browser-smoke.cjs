const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const assert = require("node:assert/strict");
const { CDP, page, sleep, origin, port, evidence } = require("./browser-smoke.cjs");
async function main() {
  await fs.mkdir(evidence, { recursive: true });
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "safe-walk-contacts-chrome-"));
  const browser = spawn(process.env.CHROMIUM_BIN || "chromium", ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`], { stdio: "ignore" });
  let root, walker, tracker;
  try {
    for (let i = 0; i < 80; i++) {
      try { const version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); root = new CDP(version.webSocketDebuggerUrl); break; } catch { await sleep(100); }
    }
    assert.ok(root, "Chromium did not start");
    await root.call("Browser.setPermission", { permission: { name: "geolocation" }, setting: "denied", origin });
    walker = await page(origin);
    await walker.wait("Where to tonight?");
    const navigation = await walker.eval(`Array.from(document.querySelectorAll('a, [role="button"]')).filter(e=>e.textContent.includes('Contacts')).map(e=>({text:e.textContent,tag:e.tagName,display:getComputedStyle(e).display,background:getComputedStyle(e).backgroundColor,bounds:{x:e.getBoundingClientRect().x,y:e.getBoundingClientRect().y,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height}}))`);
    assert.ok(navigation.length && navigation.some(n => n.bounds.width > 0 && n.bounds.x < 390), `Contacts navigation missing or invisible: ${JSON.stringify(navigation)}`);
    assert.ok(navigation.some(n => n.background !== "rgba(0, 0, 0, 0)"), "Contacts button lost its visible background");
    await walker.screenshot("contacts-map-plan");
    await walker.click("Demo"); await walker.wait("Choose route"); await walker.click("Choose route");
    await walker.wait("Your trusted contact can see your live location until you end the trip.");
    await walker.click("Start walk");
    await walker.wait("PRIVATE TRACKING LINK");
    const code = await walker.eval(`JSON.parse(localStorage.getItem('safe-walk-trip')).shareCode`);
    assert.ok(await walker.eval(`document.body.innerText.includes('Choose an app contact or share the private link')`));
    await walker.eval(`document.querySelector('[aria-label="Contacts"]').click()`);
    await walker.wait("A trusted person, one tap away.");
    await walker.wait("Share a link with anyone");
    await walker.wait("Enable optional app contacts"); await walker.click("Enable optional app contacts"); await walker.wait("Send verification code");
    const configuration = await (await fetch(`${origin}/api/config`)).json();
    for (const kind of ["email", "phone"]) {
      if (kind === "phone") await walker.click("Phone");
      const available = kind === "email" ? configuration.emailVerificationAvailable : configuration.smsVerificationAvailable;
      if (!available) await walker.wait(`${kind === "email" ? "Email" : "Phone"} verification isn't configured yet.`);
      await walker.eval(`document.querySelector(${JSON.stringify(`[aria-label="${kind === "email" ? "Your email address" : "Your phone number"}"]`)}).focus()`);
      await walker.call("Input.insertText", { text: kind === "email" ? "test@example.com" : "+14155550123" });
      await sleep(150);
      const disabled = await walker.eval(`Array.from(document.querySelectorAll('[role="button"]')).find(e=>e.textContent.trim()==="Send verification code").getAttribute("aria-disabled")==="true"`);
      assert.equal(disabled, !available, `${kind} verification button does not match provider availability`);
      // Never send a verification code from this automated browser check.
    }
    await walker.screenshot("contacts-provider-availability");
    await walker.click("Remove contact enrollment"); await walker.wait("Remove this device?");
    await walker.click("Keep enrollment"); await sleep(250);
    assert.ok(await walker.eval(`!!localStorage.getItem('safe-walk-installation')`));
    await walker.click("Remove contact enrollment"); await walker.wait("Remove this device?"); await walker.click("Remove enrollment");
    await walker.wait("Device enrollment, matching identifiers, and notification tokens removed");
    assert.equal(await walker.eval(`localStorage.getItem('safe-walk-installation')`), null);
    await walker.click("Back to map");
    await walker.wait("PRIVATE TRACKING LINK");
    tracker = await page(`${origin}/track/${code}`); await tracker.wait("Your contact is on the way.");
    assert.ok(await tracker.eval(`!!document.querySelector('.leaflet-container')`));
    await tracker.screenshot("contacts-tracking-map");
    assert.equal(await walker.eval(`Array.from(document.querySelectorAll('[role="button"]')).filter(e=>e.textContent.trim()==="I’ve arrived").length`), 1, "Returning from Contacts duplicated the walking screen");
    await walker.click("I’ve arrived"); await walker.wait("You made it.");
    await tracker.wait("Your contact has arrived.", 12000);
    assert.deepEqual(walker.errors, []); assert.deepEqual(tracker.errors, []);
    console.log("PASS: phone-width map-first walk, explicit sharing choice, contact enrollment, provider availability and verification button states (no messages sent), cancel/delete enrollment, tracking map, arrival and no uncaught browser errors.");
  } finally {
    walker?.ws.close(); tracker?.ws.close(); root?.ws.close(); browser.kill("SIGTERM");
    await fs.rm(profile, { recursive: true, force: true }).catch(() => {});
  }
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
