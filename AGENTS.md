# Workspace Rules & Architecture Guidelines

Refer to [.agents/rules/erp_stability.md](file:///.agents/rules/erp_stability.md) for full guidelines.

### Summary of Critical Invariants:
1. **UI Cleanliness**:
   - No top switcher bar inside the Attendance Register dashboard card.
   - No `[Change Sem]` or `[Refresh]` button pills in the dashboard header. Subtitle semester text is clickable to change semester.
   - In the "No Courses Found" empty state, only show `Change Academic Year / Semester`. Never add "Back to Present" buttons.
   - **Academic Year Dropdown**: Never show `(Completed)` or `(Present / Current)` tags. Show clean year strings only (e.g. `2026-2027`, `2025-2026`).
   - **Semester Dropdown**: Never show `(Sem 1)` or `(Sem 2)`. Show clean standard labels only (`Odd Sem`, `Even Sem`, `Summer Term`, `Tri Sem / Term 3`).

2. **Privacy, Captcha Modal Backdrop & Data Masking**:
   - Modal backdrop must be pure solid black overlay: `bg-black/85 backdrop-blur-md` and explicit inline `style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}`. Never use non-standard Tailwind arbitrary opacities (e.g. `bg-slate-950/98`) that fail compilation and render transparent/white.
   - When Friend Captcha Modal is active, underlying dashboard subject cards must be hidden / replaced with an "Authenticating Session" privacy card to prevent background data peeking.
   - Captcha success callback must pass `skipAttendanceCaptcha = true` (e.g. `handleSwitchProfile(prof, true)`) to prevent recursive modal prompting loops.

3. **Cross-Student Data Isolation**:
   - NEVER broadcast personal student attendance or login events to public Firestore (`config/sync`). Restrict cross-tab sync strictly to `BroadcastChannel('kl_portal_sync')` with strict `studentId === currentStudentId` validation.
   - Primary logged-in user must always be designated `id: 'main'`, `isFriend: false`, and receive the green "Primary" badge—never a "Friend" badge or duplicate entry.

4. **Live Attendance Diffing Safeguards**:
   - In-class attendance diffs in `attendanceAlerts.js` must only trigger for small deltas: `effectiveConductedDiff <= 2 && effectiveAttendedDiff <= 2`. Larger deltas are reloads/cache syncs.
   - If an absence is detected, NEVER show "Marked PRESENT". It must strictly alert `⚠️ Marked ABSENT`.

5. **User-Facing Error Sanitization**:
   - Never surface raw technical errors like `"signal timed out"`, `"AbortError"`, or `"Failed to fetch"`. Sanitize to friendly copy: `"University ERP server took longer than expected to respond. Please try again or re-verify your session."`

6. **ERP Candidate Resolution**:
   - Retain full candidate aliases for current (`2026-2027`: `29`, `18`) and past years (`2025-2026`: `28`, `17`, `19`, `18`; `2024-2025`: `27`, `16`, `17`).
   - Never break loops early on empty tables (`class="empty"` / `No results found.`).
   - Strictly separate Summer Term (ID `3`) and Term 3 (ID `4`), preventing `s.text.includes('term')` from false matching "Summer Term".
   - Use defensive number coercion (`Number(...) || 0`) everywhere in attendance calculations.

7. **Semester Coverage**:
   - Fully support Odd (`1`), Even (`2`), Summer Term (`3`), and Tri Sem / Term 3 (`4`).

8. **Multi-Domain & Edge Reliability**:
   - Seamless Cloudflare Edge Worker API fallback for `klattendancecalculator.web.app`, `klattendance.online`, and `klattendance.in`.
   - Defensive 8-10 second abort timeouts on captcha prewarm and session init to prevent hanging requests.

9. **Performance & Zero Lag**:
   - Do not use nested CPU-intensive backdrop blurs on top of heavy ambient blur divs on the selection card. Keep the card crisp `bg-white` with GPU transform acceleration (`transform-gpu`) so it never lags on mobile or laptops.

10. **Future-Proof Resilience & Zero-Error Architecture**:
    - Academic years must be generated dynamically from `new Date().getFullYear()` down to 2021 so future years (`2027-2028`, `2028-2029`, etc.) automatically appear and function without manual edits.
    - Candidate year resolution dynamically computes future ERP session IDs (`29 + (firstYear - 2026)` and `18 + (firstYear - 2026)`).
    - App must remain wrapped in `<ErrorBoundary>` to eliminate white-screen crashes.
    - Storage writes (`localStorage.setItem`) must be defensively wrapped in `try/catch` to handle private browsing and quota limits.

11. **Fixed Sidebar & Independent Right-Side Scroll**:
    - In the ERP Portal layout (`/attendance-register`, `/timetable`, `/grades`, `/bunk-simulator`, `/login`):
      The left sidebar (`ErpSidebar`) must remain 100% fixed on the left (`h-full shrink-0`), while ONLY the right content area (`<main className="flex-1 overflow-y-auto min-h-0 ...">`) scrolls.
      The outer container takes `h-screen h-[100dvh] flex flex-col overflow-hidden` and suppresses the global website footer so the portal fits the exact viewport without double scrollbars.

12. **In-App Browser (Instagram) Compatibility & Safe CORS**:
    - Cloudflare Edge Worker CORS must never set `Access-Control-Allow-Origin: *` when credentials are included; resolve from `Referer` or fall back to production origin (`klattendancecalculator.web.app`) to prevent strict WebKit CORS failures.
    - Instagram In-App Browser (IAB) assistant banner provides direct Android intent to open in Chrome and clear iOS instructions for Safari.
    - Captcha cookies must be mirrored defensively in `sessionStorage` (`kl_captcha_cookies`) to prevent in-app browser memory clearing from dropping the captcha session.
