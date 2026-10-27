# Workspace navigation scroll owner

Issue: #213. Candidate branch: `fix/workspace-navigation-scroll-owner-20261028`.

The mobile workspace rail had two horizontal scroll owners. `SideNav` centered its active link inside the inner track while the outer `.immersiveDashboardLinks` could retain a separate clipping offset. The outer rail now owns overflow and snapping; the inner navigation is an expanding, nonwrapping track. Active-link centering targets the outer rail. The workspace preview now marks its corresponding destination current, matching the production route.

Local regression coverage reproduced the wrong scroll target before implementation. After the fix, 15 focused navigation/shell/architecture tests and TypeScript passed. Added a CI WebDriver check for the Security Runs and Workspace previews at 390, 768 and 1440 pixels, asserting one scroll owner, active-link positioning, `aria-current`, no page overflow and screenshots.

Rendered Linux CI acceptance and visual inspection remain pending. No change to the separate admin navigation, authorization, workers, queue or provider capabilities.
