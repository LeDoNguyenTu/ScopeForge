# Workspace navigation scroll owner

Issue: #213. Candidate branch: `fix/workspace-navigation-scroll-owner-20261028`.

The mobile workspace rail had two horizontal scroll owners. `SideNav` centered its active link inside the inner track while the outer `.immersiveDashboardLinks` could retain a separate clipping offset. The outer rail now owns overflow and snapping; the inner navigation is an expanding, nonwrapping track. Active-link centering targets the outer rail. The workspace preview now marks its corresponding destination current, matching the production route.

Local regression coverage reproduced the wrong scroll target before implementation. After the fix, 15 focused navigation/shell/architecture tests and TypeScript passed. Added a CI WebDriver check for the Security Runs and Workspace previews at 390, 768 and 1440 pixels, asserting one scroll owner, active-link positioning, `aria-current`, no page overflow and screenshots.

The first Linux CI run `40549041861` passed and screenshots confirmed correct active-item positioning. Visual inspection still showed fragments of adjacent labels at the rail edges. A conditional mobile edge fade now marks offscreen navigation, with scroll-state attributes updated from the sole scroll owner. The fade disappears at each completed edge and does not affect keyboard access or accessible labels. Fresh CI screenshots remain required for this refinement.

No change to the separate admin navigation, authorization, workers, queue or provider capabilities.
