# Tagalong — Congressional App Challenge

## Demonstration video script

**Target length:** about 2:30. Keep the spoken script under three minutes.
Replace every bracketed name and inspiration prompt before recording. Show a
test trip and test contacts; do not expose a real home address, phone number,
contact list, private link, or write credential.

> **Accuracy note:** Vehicle-sensor accident detection is not in the current
> code. This script describes it as in development, not as a completed feature.
> Update that line only after the feature is implemented and tested.

### 0:00–0:20 — Introductions and purpose

**[Show the Tagalong home screen.]**

**[Participant 1]:** “Hi, I’m [name].”

**[Participant 2, and each additional participant]:** “I’m [name].”

**[Participant 1]:** “Our app is Tagalong. Tagalong helps people compare
walking routes using available lighting information and share an active trip
with trusted contacts.”

### 0:20–0:40 — Audience

**[Show the map and Walk/Drive selector.]**

**[Participant 2]:** “We designed Tagalong for students, commuters, and anyone
who wants an extra check-in while walking or driving. It can help someone make
a more informed route choice and let people they trust follow the trip. It is
an extra layer of support—not a guarantee of safety.”

### 0:40–1:15 — Plan and share a walk

**[Enter a test destination. Show the Fastest and Safest options, then select
one. Use a real route for this demonstration, or keep the DEMO label visible
if showing simulated data.]**

**[Participant 1]:** “For a walk, Tagalong compares the fastest route with its
estimated ‘Safest’ option. The estimate uses available lighting data; it can be
incomplete and does not promise that a street is safe or well lit right now.”

**[Start a test trip and show the sharing choices, then open its tracking page
on a second device or browser.]**

**[Participant 2]:** “The walker can share with enrolled app contacts or send
a private tracking link. The contact can see the route, the latest location,
and the trip status. The Help action marks the trip and stops location
updates; it does not call emergency services.”

### 1:15–1:55 — Drive mode and safety features

**[Return to planning, select Drive, and show the route estimate and the
remote-stop disclosure. Do not stage a false live alert as a real event.]**

**[Participant 1]:** “Drive mode provides route estimates and trip sharing; it
is not turn-by-turn navigation. On a real drive, if reliable location stays
within about 35 meters for 60 seconds and map data shows no mapped buildings
or places within 250 meters, Tagalong starts a 15-second cancel window. If it
isn’t canceled, app contacts receiving that drive are warned while the trip
stays active. This is a map-based remote-stop heuristic, not crash detection.”

### 1:55–2:30 — Technology and close

**[Show the app and, briefly, its tracking view.]**

**[Participant 2]:** “We built Tagalong with Expo and React Native, using
TypeScript for the app and its Node.js and Express server, with SQLite for
trip data. OpenRouteService provides route estimates, and OpenStreetMap data
supports maps and lighting estimates.”

**[Participant 1]:** “We’re developing a separate feature that would use
vehicle sensors to detect possible car accidents. It is not in this version
yet, so we are not presenting it as a working feature today. Tagalong is
designed to support check-ins and informed choices—not replace emergency
services. Thank you for watching.”

## Draft answers to the application questions

Personalize these answers so they reflect the team’s actual experience.

1. **What is the title of your app?**  
   Tagalong.

2. **Explain the app’s purpose.**  
   Tagalong helps people compare walking routes using available lighting
   information and share an active trip with trusted contacts.

3. **What inspired you to create it?**  
   “We were inspired by [describe a real experience or concern in your
   community]. We wanted to make it easier to compare route information and
   check in with people you trust.” Replace the bracket with the team’s real
   story; don’t invent a personal experience.

4. **What technical or coding difficulty did you face, and how did you address
   it?**  
   “One challenge was making location sharing work across web and phones while
   respecting privacy and handling unreliable GPS or network connections. We
   separated the private trip-writing credential from the link shared with a
   contact, limited how long trip links remain active, and show when a location
   may be old. Contact matching uses verified identifiers without storing the
   address book on the server.”

5. **What did you learn, and what was your biggest takeaway?**  
   “We learned how much real-world apps depend on permissions, device behavior,
   network access, and the quality of outside map data. Our biggest takeaway is
   that a safety app must be clear about uncertainty: a route estimate or
   location update can help, but it can’t guarantee someone’s safety.”

6. **What would you change in a 2.0 version?**  
   “We would improve map coverage and accessibility, test background location
   behavior on more devices, and continue developing vehicle-sensor accident
   detection. We would validate that feature carefully before relying on it or
   describing it as complete.”

## Recording checklist

- Keep the finished video between **1 and 3 minutes**; aim for about 2:30.
- Say every participant’s name and the app name.
- Include the purpose sentence, target audience, technologies, and a clear
  screen demonstration.
- Use test accounts and routes. Keep any simulated-data label visible.
- Upload to YouTube or Vimeo and set the video to **Public**.
