# Run Tagalong in Expo Go

The **Expo Go** workflow starts Expo with a fresh tunnel and prints a new QR code.
The main **Project** workflow also starts it. Open the Expo Go workflow log after
startup/restart and scan its QR code with the Expo Go app on your phone.

Keep the **web** and **API** workflows running: the mobile app reaches the
development API through the HTTPS `/api` proxy on the current Replit development
domain. The Expo workflow sets that address into the JavaScript bundle.

This is an Expo Go preview, not a signed native build. Walk planning, demo walks,
foreground location, and the contact-sync permission flow can be tested. Expo Go
does not include Tagalong's custom iOS Live Activity or Android widget modules;
remote push delivery and those widgets require an EAS development or production
build. The walker still shares location only while the app is open in the
foreground.
