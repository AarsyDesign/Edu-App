# DESIGN-SYSTEM.md — Calm Islamic Kids Learning UI

## 0. Design North Star

“Playful without being noisy.”

The app should feel:
- warm
- safe
- premium
- colorful
- calm
- tactile
- child-friendly
- parent-approved

It must NOT feel:
- like a gambling game
- like a social media feed
- like an AI-generated kids template
- like a generic cartoon app
- like a school administration dashboard

## 1. Visual Principles

1. One visual hero per screen.
2. One primary action per screen.
3. Use generous whitespace.
4. Use color to establish hierarchy, not decoration everywhere.
5. Motion should communicate state, not demand attention.
6. Avoid repeated cards for every element.
7. Avoid excessive pills.
8. Avoid gradients as default background treatment.
9. Avoid generic mascot characters.
10. Prefer bespoke geometric illustration.

## 2. Palette

Base:
- Ivory: #FFF9EE
- Warm White: #FFFCF7
- Deep Green: #174A3A
- Soft Green: #DDEDE2
- Sage: #A9C7B3
- Warm Yellow: #F5E885
- Soft Blue: #DDEAF5
- Soft Peach: #F7DCCB
- Ink: #26332D
- Muted Ink: #6C776F
- Success Green: #3F8F62
- Warning Amber: #C68A25
- Error Red: #B85A52

Color must not be the sole carrier of correctness.

## 3. Typography

Prefer a friendly, highly legible sans serif.

Suggested:
- Headings: Nunito Sans / equivalent rounded humanist sans
- Body: Inter / equivalent
- Numbers: same family with tabular numerals when useful

Avoid overly playful display fonts for body UI.

## 4. Shape Language

- rounded corners, but not excessive
- 16–24px radius for major cards
- 12–16px for controls
- large touch areas
- soft, physical card elevation
- subtle borders instead of heavy shadows

## 5. Iconography

Use simple line/filled icons with consistent stroke.

Prefer:
- stars
- book
- pencil
- number blocks
- geometric shapes
- moon
- lantern
- home
- progress markers

No human/animal icon characters.

## 6. Illustration Direction

Illustrations should look commissioned, not stock.

Use:
- geometric Islamic patterns
- paper cut / soft flat shapes
- classroom objects
- architecture
- abstract shapes
- numbers and letters

Do not use:
- stock cartoon children
- AI-looking generic mascots
- random animals
- overly detailed scenes

## 7. Motion

Micro-interactions:
- tap response: 120–180ms
- card transition: 180–300ms
- success response: 300–700ms
- page transition: 200–350ms

No continuous animated background.

Reduced-motion mode must disable nonessential animation.

## 8. Audio

- Music OFF by default.
- Short SFX optional.
- Voice instructions optional for pre-literacy.
- Every audio feature has a mute control.
- Never make loud audio the primary reward mechanism.

## 9. Child Screen Template

Top:
- progress indicator
- optional back/home

Middle:
- one activity
- large visual
- concise prompt

Bottom:
- large answer area
- generous spacing

Never crowd the screen with secondary information.

## 10. Parent Screen Template

More information density is acceptable, but:
- use charts sparingly
- prioritize actionable insights
- show “what to practice next”
- avoid vanity metrics

## 11. States

Every screen must have:
- loading
- empty
- success
- error
- offline/degraded state when relevant

Activity states:
- unanswered
- selected
- correct
- incorrect
- retry
- completed

## 12. Anti-Slop Checklist

Reject a design if it:
- looks like a generic SaaS dashboard
- uses identical cards for everything
- uses excessive gradients
- uses random decorative blobs
- uses excessive glassmorphism
- uses AI-looking stock illustrations
- uses huge hero text with no information
- has too many pills
- animates everything
- uses inconsistent corner radii
- has inconsistent spacing
- has decorative elements competing with the activity
- uses color without semantic reason

Before shipping a screen:
1. identify the visual hierarchy
2. remove 20% of decorative elements
3. verify touch targets
4. verify age appropriateness
5. verify parent trust
6. test with audio muted
7. test reduced motion
8. test on a small phone and tablet
