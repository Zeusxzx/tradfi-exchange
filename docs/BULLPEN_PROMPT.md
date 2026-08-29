# Bullpen scene prompt — v3 (written 2026-08-29, NOT YET RUN — fal balance exhausted)

## What was wrong with v2
- Said "1990s brokerage bullpen" -> model gave beige cubicle farm, drop ceiling,
  fluorescent panels, CRTs, no visible screen content. Looked 1960s.
- Said "punches the air" / "shouts" -> two men at the back read as dancing.
- Said "twenty brokers" with no individual description -> every face the same man.
- No instruction that screens must be ON and readable -> monitors were dark/backs-to-camera.

## The fix
Describe the ROOM as present-day and expensive. Describe EVERY person individually
(age, build, clothing, exact posture, exact hand position, where they are in frame).
State explicitly that every screen is on and facing camera. Ban the failure modes.

## DAY PROMPT
Candid documentary photograph, shot on ARRI Alexa with a 32mm lens at f/4, natural motion blur on
anyone moving, real skin texture, real fabric, imperfect and unposed. Locked-off symmetrical
one-point perspective looking straight down the centre walkway, camera at standing eye height.

SETTING: the trading floor of an elite modern Manhattan hedge fund, present day 2020s. Expensive
and restrained: blackened steel and dark walnut bench desks in two long rows either side of a wide
walkway, no cubicle partitions of any kind, polished concrete floor, exposed black ceiling with
linear architectural downlights, floor-to-ceiling glass on both sides looking onto the Manhattan
skyline, a frameless glass writing wall on the right covered in marker notation. Filling the far
wall is a huge seamless LED video wall showing live candlestick charts, a heat map of red and green
tiles, and scrolling price rows. Every single desk carries a curved ultrawide monitor plus a stacked
pair of vertical monitors above it, and EVERY SCREEN IS ON AND CLEARLY VISIBLE to camera, glowing
with candlestick charts, depth-of-market ladders, order books and terminal windows in green, red and
amber. Wireless headsets, mechanical keyboards, aluminium laptops, water bottles, a few coffee cups.
Warm practical light against the cool daylight from the glass.

THE PEOPLE - sixteen traders, every one a DIFFERENT person: different age, different build,
different hair, different clothes. No two faces alike. Each is doing one specific ordinary thing:
- front left, closest to camera: a woman in her thirties in a charcoal blazer, seated, leaning
  forward with both forearms on the desk, eyes locked on her ultrawide chart, one finger resting on
  the scroll wheel.
- front right, closest to camera: a heavyset man in his fifties in a navy quarter-zip, seated and
  turned three-quarters away, one hand pinching the bridge of his nose, the other hovering over his
  keyboard.
- mid left: two men shoulder to shoulder over one monitor, an older man in shirtsleeves pointing at
  the screen while a younger man in a grey hoodie holds a coffee cup and nods.
- mid right: a young woman standing at her desk in a white shirt, wireless headset on, one hand flat
  on the desk, the other raised loosely mid-sentence as she talks to a client.
- centre walkway, mid-distance, walking toward camera: a man in his forties in a fitted navy shirt
  with sleeves rolled, looking down at the phone in his hand, walking with real motion blur in his
  legs.
- centre walkway, further back, walking away from camera: a woman in a cream blazer carrying an open
  laptop.
- right, at the glass writing wall: a woman in her twenties writing figures on the glass with a
  black marker, seen from behind.
- back left: a bearded man standing with both hands on the back of his chair, staring up at the LED
  wall.
- back right: a man seated leaning far back in his Aeron chair with his hands behind his head.
- scattered between them: five more seated traders, heads down, typing, reading, one drinking from a
  bottle, one turned to speak to the person behind him.

Nobody is posing. Nobody has both arms in the air. Nobody is dancing or celebrating. This is an
ordinary busy Tuesday morning. Quiet expensive intensity.

NOT a 1990s office. NO beige cubicle partitions, NO CRT monitors, NO corded telephone handsets, NO
paper taped to walls, NO drop ceiling tiles, NO fluorescent panel lights, NO identical faces, no
text overlays, no logos, no watermark.

## NIGHT
Generated as an IMAGE EDIT of the chosen day frame (nano-banana/edit), never a fresh text prompt --
that is what made v1 a different building. Prompt: same room, same camera, same desks, 2am, all
ceiling light off, lit only by the LED wall on standby, a few live monitors and cold city glow.
Two traders asleep at their desks, one janitor with a mop and bucket in the walkway. Everyone else
gone, chairs turned askew.

## MOTION (Seedance i2v, camera_fixed, 12s)
Per-person actions named in the same order as the still, so each figure keeps doing the thing it was
already doing rather than being reinvented by the video model.

## Pipeline
flux-pro/v1.1-ultra or seedream/v4 (2 candidates each) -> pick -> nano-banana/edit for night ->
seedance v1 pro i2v 1080p 12s both -> loopcut.sh (crop 1920x1080, best-pair loop search, 1s baked
crossfade) -> 720p mp4 + webm + poster.
