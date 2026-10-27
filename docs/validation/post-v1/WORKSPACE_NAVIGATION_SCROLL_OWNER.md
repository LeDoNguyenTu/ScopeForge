# Workspace navigation scroll owner

Issue: #213. Candidate branch: `fix/workspace-navigation-scroll-owner-20261028`.

The mobile workspace rail had two horizontal scroll owners. `SideNav` centered its active link inside the inner track while the outer `.immersiveDashboardLinks` could retain a separate clipping offset. The outer rail now owns overflow and snapping; the inner navigation is an expanding, nonwrapping track. Active-link centering targets the outer rail. The workspace preview now marks its corresponding destination current, matching the production route.

Local regression coverage reproduced the wrong scroll target before implementation. After the fix, 15 focused navigation/shell/architecture tests and TypeScript passed. Added a CI WebDriver check for the Security Runs and Workspace previews at 390, 768 and 1440 pixels, asserting one scroll owner, active-link positioning, `aria-current`, no page overflow and screenshots.

The first Linux CI run `40549041861` passed and screenshots confirmed correct active-item positioning. Visual inspection still showed fragments of adjacent labels at the rail edges. A conditional mobile edge fade now marks offscreen navigation, with scroll-state attributes updated from the sole scroll owner. The fade disappears at each completed edge and does not affect keyboard access or accessible labels. Fresh CI screenshots remain required for this refinement.

No change to the separate admin navigation, authorization, workers, queue or provider capabilities.

## Released production verification

Final candidate `a966e6cb4d32207777c2fc80720759f1f99142cc` passed full CI `40550299116`. The owner explicitly authorized its administrative merge, producing `444d7ffcfb59527d7aa141f4570606b6d9093771`. The combined final release through PR #218 is `a577739230a2b717caabfc28e8a33cad2a2e0c64`, deployed READY as `dpl_6eHQiN19RLYsXLFreRYxVFYh9UhR`.

The existing authenticated Chrome profile loaded both production `/dashboard/security-runs` and `/dashboard/workspace`. At the effective 520 CSS-pixel viewport, DOM geometry and screenshots confirmed outer overflow `auto`, inner overflow `visible`, full active-link containment, conditional edge fading and no document-level overflow. Keyboard Tab from Workspace moved focus to Account & security and kept that destination fully visible. No account, workspace or provider mutation was performed. The temporary viewport override was reset. The 390/768/1440 matrix is separately covered by the CI screenshots and browser checks. Issue #213 is closed.
