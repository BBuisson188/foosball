# Foosball Arcade — Initial Design Implementation Spec

## Purpose

This document is the single source of truth for the first playable build of the Foosball Arcade web app game.

The goal is not to make a perfect real-world foosball simulator. The goal is to make a polished, arcade-style foosball game that is easy for kids and casual players to pick up, while still having enough control and strategy to stay fun.

The first build should feel like a final-quality game foundation, even if tuning and added polish continue later.

---

# 1. Core Gameplay Loop

## Game Concept

The game is an overhead-view foosball-style arcade game.

The player controls the blue team on the left side of the table. The computer controls the red team on the right side.

The game should be:
- Fast
- Tactile
- Fun
- Arcade-like
- Strategic enough to reward timing and control
- Simple enough for kids to understand quickly

## Match Flow

1. Start screen / setup screen appears.
2. Player chooses difficulty:
   - Easy
   - Medium
   - Hard
3. Gameplay begins in fullscreen-style board mode.
4. Native browser scrolling should be disabled during play.
5. The board should fill the available play area as much as possible.
6. Ball is served manually using a round **BALL** button.
7. Players move rods, kick, lift, pass, and spin using touch gestures.
8. Goals trigger a short celebration/pause.
9. After a goal, the ball does not automatically respawn. The **BALL** button appears again.
10. Tapping **BALL** launches a new ball from the side wall toward the center.

## Desired Feel

The target feel is **controlled chaos**.

The game should not feel like pure random pinball, but it also should not feel slow or overly technical. The player should feel like they can influence passes, shots, and saves through timing and movement, while the ball still has enough arcade unpredictability to stay exciting.

---

# 2. Table Layout and Rod Layout

## Table View

Use an overhead view of a foosball table.

The field art will be supplied separately by the user. The board image already includes:
- Field surface
- Goal areas
- Control zones
- General table layout

Do not draw extra instructional panels on the live game board. Controls can be explained before the game starts, but the live game should stay clean.

## Team Layout

Blue team is on the left side.
Red/computer team is on the right side.

Use traditional foosball rod layout.

Each side has 4 rods:

### Blue side, left to right:
1. Goalie rod — 1 player
2. Defense rod — 2 players
3. Midfield rod — 5 players
4. Attack rod — 3 players

### Red side, right to left:
1. Goalie rod — 1 player
2. Defense rod — 2 players
3. Midfield rod — 5 players
4. Attack rod — 3 players

The two teams are mirrored across midfield.

## Rods

The rod artwork should be separate from player artwork.

Players slide vertically along their rod. The rod itself does not need to animate with each player frame.

The visual illusion should be:
- Rods stay visually fixed horizontally.
- Players slide up/down along the rods.
- Player sprites swap states for neutral, lifted, kick, and spin.

---

# 3. Input System, Control Zones, and Multitouch

## Control Zones

The game board art includes control zones directly over the rods/players.

Each rod has its own control zone.

A touch must begin inside a rod's control zone in order to claim that rod.

Control zones should match the player's side of the board. This keeps the design compatible with possible future local multiplayer.

## Multitouch Limit

Support a maximum of **2 active touches** for the human player.

This allows the player to control up to two rods at the same time.

Examples:
- Midfield + attack
- Defense + goalie
- Defense + attack

## Touch Ownership Rule

When a finger touches down inside a rod control zone, that finger owns that rod until the finger lifts.

Once a rod is owned:
- Vertical movement continues controlling that rod even if the finger moves outside the original control zone.
- Horizontal movement continues controlling that rod even if the finger moves outside the original control zone.
- The touch does not accidentally switch to a different rod.
- Control ends only when the finger lifts.

## Duplicate Touch on Same Rod

If two touches try to control the same rod, use the newest touch as the active owner of that rod.

The older touch should stop controlling that rod.

## Active Rod Definition

A rod is considered **active** while a finger is touching and controlling it.

Optionally, a rod can remain active for a very short grace period after release, around 100–150ms, to avoid abrupt physics changes.

Active rods deflect the ball harder than passive rods.

Passive rods absorb more ball momentum.

---

# 4. Rod States and Gesture Rules

Each rod has persistent and temporary states.

## Core Rod States

### 1. Neutral / Feet Down

Default state.

The players' feet are down and can collide with the ball.

Ball interaction:
- Normal collision
- Deflection
- Passing influence based on vertical rod movement
- Moderate momentum loss

### 2. Lifted / Feet Up

Triggered by moving the finger backward, toward the player's own goal.

For blue on the left, backward means moving left.
For red on the right, backward means moving right.

When the rod is fully lifted:
- The players stay lifted even after the finger releases.
- The ball passes straight under the players.
- Lifted players should not affect the ball at all.
- Treat lifted players as having zero collision.

This is a persistent posture state.

The rod stays lifted until the player touches that rod again and changes the posture.

### 3. Kick

Triggered by moving the finger forward, toward the opponent's goal.

For blue on the left, forward means moving right.
For red on the right, forward means moving left.

A standard kick occurs when:
- The finger moves forward while still touching.
- The rod performs a quick kick impulse.
- The rod recoils back to neutral/feet-down.
- The player maintains control of the rod if the finger remains touching.

Kick strength depends on horizontal finger speed.

Slow forward motion:
- Soft kick / controlled pass

Fast forward motion:
- Hard shot / strong clear

### 4. Spin Kick

Triggered by:
- Moving the finger forward quickly
- Releasing the finger during or immediately after that forward motion

Spin kick behavior:
- Rod spins freely for a brief moment.
- Spin kick adds more power than a standard kick.
- Spin kick is less accurate and more chaotic.
- After the spin, the rod randomly lands in either:
  - Neutral / feet down
  - Lifted / feet up

Spin should be fun and powerful, but risky.

## Gesture Dead Zone

Add a horizontal dead zone so tiny finger jitter does not trigger accidental kicks or lifts.

Recommended starting point:
- Ignore horizontal movement within roughly 8–14 pixels or equivalent scaled value.

## Vertical Movement

Vertical movement is always active while the rod is owned.

Vertical movement:
- Moves the rod up/down.
- Continues during neutral, lift, kick, and recovery.
- Does not get locked out during a kick.
- Directly affects sideways passing by transferring rod vertical velocity to the ball.

## Finger Release Rules

On finger release:
- If rod is held backward/lifted, it remains lifted.
- If rod was moved forward slowly or moderately and not released as a flick, it performs/finishes a normal kick and returns to neutral.
- If rod was moved forward quickly and released during the thrust, trigger spin kick.
- If no meaningful horizontal gesture occurred, rod remains in its current state.

---

# 5. Ball Physics and Momentum

## Overall Ball Feel

The ball should feel like an arcade ball, not a perfect physics simulation.

Target feel:
- Fast enough to be exciting
- Slow enough to react to
- Always moving
- Never stuck
- Slightly unpredictable at slow speeds
- More stable at high speeds

## Minimum Speed

The ball should never come to a complete stop.

Use a very low minimum speed.

This prevents:
- Dead balls
- Corner traps
- Awkward stalls
- Frozen gameplay

If the ball slows below the minimum speed, normalize it back up to minimum speed while preserving its direction.

If direction becomes unstable or trapped, apply a tiny smooth direction nudge.

## Maximum Speed

Use a maximum speed cap.

The fastest speed should occur on very hard flick/spin kicks.

The speed cap prevents:
- Ball becoming unreadable
- Tunneling through collision objects
- Unfair reaction moments

## Rolling Friction

The ball constantly loses a very small amount of speed while rolling.

This should be subtle.

The ball should slow over time, but never below minimum speed.

## Random Curviness / Slow Ball Drift

The ball should have a slight organic drift or curve.

This should be speed-dependent:

### Slow ball
More drift/curviness.

### Fast ball
Very little drift/curviness.

This keeps slow gameplay from becoming stale and helps prevent the ball from getting stuck in predictable dead lanes.

Important:
- Drift should be smooth, not jittery.
- Avoid random frame-by-frame direction jumps.
- Use smooth noise, gentle sine-like drift, or another gradual method.

## Ball Serve

When served using the BALL button:
- Ball appears quickly from a side entry point, like a real foosball table side hole.
- Ball shoots from the side toward the center.
- Add slight random vertical variance so serves do not feel identical.
- The ball should initially travel toward the center area.

---

# 6. Collision and Contact Rules

## Universal Momentum Rule

Every deflection reduces ball momentum to some degree.

This applies to:
- Walls
- Active rods
- Passive rods
- Kicks
- Player collisions

Momentum reduction should prevent endless high-energy bouncing.

## Wall Collisions

Wall rebounds should feel lively but should still reduce speed slightly.

Sidewall collision:
- Reflects ball direction
- Reduces speed by a modest percentage
- Keeps bank shots fun

## Active Player Collision

A player is active if its rod is currently finger-controlled, or within the short active grace period after release.

Active player collision:
- Deflects the ball more firmly
- Transfers rod vertical velocity into ball movement
- Reduces speed moderately, similar to sidewall behavior
- Can add shot/pass energy if kick or vertical motion is involved

Active collisions should reward active control.

## Passive Player Collision

A passive player is on a rod with no current touch controlling it.

Passive player collision:
- Still rebounds the ball
- Dramatically reduces ball speed compared with active collision
- Creates a soft "sticky deflection" feel
- Never truly traps or stops the ball
- Should trigger a small rod shake animation

This gives inactive rods a defensive absorbing quality.

## Lifted Player Collision

Lifted players do not collide with the ball.

When a rod is fully lifted:
- Ball passes straight underneath.
- No deflection.
- No slowdown.
- No shake.
- No contact response.

## Sticky Deflection, Not Trapping

Do not implement true trapping.

The ball should never hit a player and stop completely.

Instead:
- Slow-moving balls rebound slowly.
- Passive hits absorb speed heavily.
- This may feel like a trap, but the ball always continues moving.

## Vertical Passing

When a ball contacts a feet-down player, the rod's vertical movement affects the outgoing ball vector.

Slow vertical movement:
- Soft angled pass

Fast vertical movement:
- Strong sideways redirect

Vertical velocity should influence both:
- outgoing angle
- outgoing sideways momentum

This is a key skill mechanic.

## Kick Impulse

Kick impulse is based on forward finger speed.

Slow kick:
- Adds a small amount of speed
- Useful for controlled passes

Fast kick:
- Adds a large amount of speed
- Useful for shots and clears

Spin kick:
- Adds the most power
- Adds slightly more randomness
- Less precise than normal kick

---

# 7. Scoring, Goal Flow, and Manual Ball Serve

## Goal Detection

A goal occurs when the ball fully enters a goal area.

## Goal Feedback

On goal:
- Short freeze
- Camera shake
- Goal sound
- Scoreboard updates
- Optional flash or quick celebration effect

Keep this short and snappy.

## No Automatic Ball Respawn

After a goal, do not automatically respawn or relaunch the ball.

Instead:
- Pause active ball play.
- Show a round **BALL** button at the bottom center of the board.

## BALL Button

The BALL button:
- Appears at game start.
- Appears after each goal.
- Is round.
- Is placed near the bottom center of the board.
- Says **BALL**.
- Should feel like part of the arcade interface.

When tapped:
- Hide the button.
- Launch the ball from the side of the board toward center.
- Resume gameplay.

## Serve Direction

For the first build, use a simple side-entry serve.

Recommended:
- Serve from the side of the player who was scored on.
- If too complex for first build, alternate serve sides or choose a fixed side with slight randomization.

---

# 8. Computer AI Difficulty

The game has 3 distinct computer opponents based on skill/difficulty.

AI should feel like it is playing the same game, not cheating by using impossible physics.

## Easy AI

Easy AI should feel beginner-friendly.

Behavior:
- Slower reaction time
- Less accurate positioning
- Controls fewer rods well
- Rarely uses lifted feet intentionally
- Rarely uses spin kicks
- Lower kick strength
- More missed blocks
- Often reacts to current ball position instead of predicting

## Medium AI

Medium AI should feel competent but beatable.

Behavior:
- Decent reaction time
- Better rod positioning
- Attempts basic passes
- Uses active rods more often
- Sometimes uses lifted feet to open lanes
- Occasionally uses spin kicks
- Moderate kick strength
- Some basic rebound prediction

## Hard AI

Hard AI should feel smart and challenging.

Behavior:
- Faster but still believable reaction time
- Predictive positioning
- Uses two-rod coordination
- Uses lifted rods strategically
- Performs stronger redirects
- Uses wall banks and rebound setups
- Uses spin kicks intentionally but not constantly
- Better at blocking shots and opening passing lanes

## AI Design Principle

Difficulty should come mostly from:
- Better positioning
- Better timing
- Better prediction
- More intentional rod state use

Avoid making hard AI unfair through impossible speed or perfect reactions.

---

# 9. Rendering, Art Assets, and Visual Feedback

## Visual Style

Use stylized arcade visuals.

Target:
- Clean
- Bright
- Playful
- Polished
- Mobile-friendly
- Easy to read

Avoid clutter on the live game board.

## Field Art

The field/table image will be supplied separately by the user.

It should be used as the main board background.

Do not add:
- Extra side labels
- Instruction panels
- Large control explanations
- Dotted lines
- Unwanted overlays

## Player Art

Player art should be separate transparent PNG files.

Do not include:
- Green field background
- Rod/bar artwork
- Shadows that conflict with the board unless intentionally designed
- Extra padding differences across states

Each player state image should:
- Use transparent background
- Have the same canvas size
- Use the same pivot/center alignment
- Be easy for Codex to place on a rod

## Recommended Player States

For each team color:
- neutral
- lean_left
- lean_right
- kick_forward
- lift_back
- spin_1
- spin_2
- spin_3
- spin_4

Runtime should use sprite swapping rather than trying to crop from a complicated sprite sheet.

## Visual Feedback

### Active rod
Show subtle glow, highlight, or control-zone brightening.

### Lifted rod
Player sprite should clearly show feet lifted/back.

### Kick
Use a quick snapping animation.

### Spin
Use rapid frame cycling through spin sprites.
Optional blur/trail effect.

### Passive collision
Rod/player should shake slightly.

### Strong hit
Add brief ball trail or impact flash.

### Goal
Use camera shake and quick celebration effect.

## Ball

The ball should be clearly visible against the field.

Consider:
- Subtle shadow
- Small highlight
- Optional trail at high speed
- Clear collision feedback

---

# 10. Technical Architecture and Implementation Requirements

## Recommended Build Type

Use HTML/CSS/JavaScript with a Canvas-based game loop.

This can be done in plain JavaScript unless the existing project requires a specific framework.

Canvas is preferred because:
- Smooth 60fps rendering
- Easier game physics
- Easier touch tracking
- Better animation control
- Better performance than DOM-based sprites

## Game Loop

Use a fixed or semi-fixed timestep for physics.

Separate:
- Input handling
- Physics update
- Collision resolution
- AI update
- Rendering

## Screen Behavior

During active gameplay:
- Board should fill the screen as much as possible.
- Disable native browser scrolling.
- Disable overscroll behavior.
- Prevent text selection.
- Prevent accidental page gestures where possible.
- Use `touch-action: none` on the game area.

## Orientation

Landscape gameplay is preferred.

Portrait menus are acceptable, but gameplay should be optimized for landscape.

## Scaling

All game coordinates should be based on a normalized board coordinate system, not hard-coded screen pixels.

This allows:
- Responsive scaling
- Different device sizes
- Easier asset placement
- Better collision consistency

## Collision System

Use simple arcade collision, not full rigid-body simulation.

Recommended:
- Ball as circle
- Players as simplified collision shapes
- Walls as rectangles/segments
- Goals as rectangular scoring zones

Avoid overcomplicating physics.

## Input Data to Track

For each active touch:
- touch id
- owned rod id
- start x/y
- current x/y
- previous x/y
- horizontal delta
- vertical delta
- horizontal velocity
- vertical velocity
- timestamp
- release velocity

## Rod Data to Track

For each rod:
- team
- rod type
- x position
- y range
- current y offset
- current vertical velocity
- state: neutral, lifted, kicking, spinning
- active touch id, if any
- last active timestamp
- player count
- player positions along rod
- cooldown/recovery timers

## Ball Data to Track

For the ball:
- x/y position
- velocity x/y
- speed
- radius
- state: waiting, served, active, goal_pause
- drift phase/noise seed
- last collision information

## Initial Build Priority

Prioritize this order:

1. Board rendering
2. Rod/player placement
3. Touch ownership
4. Vertical rod movement
5. Lift state
6. Standard kick
7. Ball physics and collision
8. Passive vs active collision behavior
9. Manual BALL serve
10. Basic AI
11. Goal detection and scoring
12. Visual polish

## Do Not Build Yet Unless Needed

Avoid spending first-build time on:
- Online multiplayer
- Leaderboards
- Unlock systems
- Powerups
- Complex menus
- Advanced particle systems
- Full tournament mode

Those can come later.

---

# First-Build Success Criteria

The first playable build is successful if:

1. The board fills the screen and feels like a real game.
2. Touching a rod zone reliably controls that rod.
3. Two-touch control works.
4. Rods move vertically smoothly.
5. Forward motion kicks.
6. Forward flick-release spins.
7. Backward motion lifts and stays lifted after release.
8. Lifted players allow the ball to pass under.
9. Active rods deflect harder than passive rods.
10. Passive rods create a sticky-deflection feel without stopping the ball.
11. Ball never stops completely.
12. Ball serve works through the BALL button.
13. Goals feel satisfying.
14. AI can play at a basic level.
15. The game already feels polished enough to iterate from.
