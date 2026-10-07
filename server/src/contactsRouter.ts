import { Router, type Request } from "express";
import { authenticateInstallation, beginVerification, confirmVerification, createInstallation, discoverContacts, installationProfile, removeInstallation, updateInstallation } from "./identities";
import { receivedTrips, removeWidgetSubscription, shareToInstallations, subscribeWidget } from "./notifications";
import { verificationGateway } from "./verificationGateway";
import { remoteWidgetsAvailable } from "./apns";
import { rateLimit } from "./rateLimit";

export const contactsRouter = Router();
const token = (r: Request) => r.headers.authorization?.startsWith("Bearer ") ? r.headers.authorization.slice(7) : undefined;
export async function contactsConfig() {
  const c = await verificationGateway.capabilities();
  return { smsVerificationAvailable: c.sms && !!process.env.SESSION_SECRET,
    emailVerificationAvailable: c.email && !!process.env.SESSION_SECRET, remoteWidgetsAvailable: remoteWidgetsAvailable() };
}
contactsRouter.post("/installations", rateLimit(20, 3600000), (r, s) => s.status(201).json(createInstallation(r.body?.platform)));
contactsRouter.get("/installations/me", (r, s) => s.json(installationProfile(authenticateInstallation(token(r)))));
contactsRouter.patch("/installations/me", (r, s) => s.json(updateInstallation(authenticateInstallation(token(r)), r.body ?? {})));
contactsRouter.delete("/installations/me", (r, s) => s.json(removeInstallation(authenticateInstallation(token(r)))));
contactsRouter.post("/installations/verify", rateLimit(6, 3600000), async (r, s) => s.json(await beginVerification(authenticateInstallation(token(r)), r.body ?? {})));
contactsRouter.post("/installations/confirm", rateLimit(30, 3600000), (r, s) => s.json(confirmVerification(authenticateInstallation(token(r)), r.body ?? {})));
contactsRouter.post("/contacts/discover", rateLimit(240, 3600000), (r, s) => s.json(discoverContacts(authenticateInstallation(token(r)), r.body ?? {})));
contactsRouter.get("/inbox", (r, s) => s.json({ trips: receivedTrips(authenticateInstallation(token(r))) }));
contactsRouter.post("/trips/:id/share", rateLimit(30, 3600000), (r, s) =>
  s.json(shareToInstallations(r.params.id as string, r.headers["x-trip-token"] as string | undefined, authenticateInstallation(token(r)), r.body?.installationIds)));
contactsRouter.post("/track/:code/widget", rateLimit(60, 3600000), (r, s) => s.json(subscribeWidget(authenticateInstallation(token(r)), r.params.code as string, r.body ?? {})));
contactsRouter.delete("/track/:code/widget", (r, s) => {
  const installation = authenticateInstallation(token(r));
  removeWidgetSubscription(installation.id, r.body?.activityId);
  s.json({ ok: true });
});
