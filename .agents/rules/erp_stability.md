# KL ERP Attendance Stability & Architecture Guardrails

This document establishes the permanent, non-negotiable architectural rules, stability guidelines, and invariants for the KL Attendance project. Every agent and developer working on this codebase MUST strictly adhere to these rules without exception.

---

## 1. UI Design Guardrails (Cleanliness & Zero Clutter)
- **NO Redundant Action Buttons in Dashboard Header**:
  - Do NOT re-add `[Change Sem]` or `[Refresh]` button pills to the dashboard header.
  - The semester name in the header subtitle (`${displayYearText} · ${displaySemesterText} Semester`) is clickable and invokes `handleBack()` cleanly.
- **NO Intrusive Buttons in Empty States**:
  - In the "No Courses Found" empty state, only show the single clean button: `Change Academic Year / Semester`.
  - NEVER re-add buttons like `Back to Present (2025-2026 Even)` or any hardcoded redirect buttons inside the empty state.
- **NO In-Dashboard Session Switcher Bars**:
  - Do NOT place a custom year/semester switcher bar directly into the dashboard card view. The selection interface belongs strictly on the dedicated selection screen (`handleBack()`).
- **Academic Year Dropdown Labels**:
  - NEVER show `(Completed)`, `(Present / Current)`, or badges in academic year options.
  - Display strictly clean year strings: `2026-2027`, `2025-2026`, `2024-2025`, `2023-2024`, `2022-2023`, `2021-2022`.
- **Semester Dropdown Labels**:
  - NEVER show `(Sem 1)` or `(Sem 2)` in semester options.
  - Display strictly clean standard labels: `Odd Sem`, `Even Sem`, `Summer Term`, `Tri Sem / Term 3`.

---

## 2. Privacy, Modal Backdrops & Background Data Masking
- **Friend Captcha Modal Backdrop**:
  - The modal overlay MUST be pure dark black: `className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md font-sans"` supplemented with inline `style={{ backgroundColor: 'rgba(0, 0, 0, 0.85)' }}`.
  - NEVER use non-standard Tailwind arbitrary opacity (such as `bg-slate-950/98`) which fails Tailwind compilation and leaves the background transparent/white.
- **Background Data Masking While Entering Captcha**:
  - When `targetFriendForCaptcha` is active in `src/pages/AttendanceRegister.jsx`, underlying subject cards MUST be hidden and replaced with an "Authenticating Session" card. No student attendance data may peek or be visible behind the captcha modal.
- **Friend Captcha Loop Prevention**:
  - In `src/components/ErpSidebar.jsx` and all profile switching flows, the `onSuccess` callback MUST invoke `handleSwitchProfile(prof, true)` with `skipAttendanceCaptcha = true` to prevent recursive re-triggering of the modal.

---

## 3. Cross-Student Data Isolation & Privacy Invariants
- **No Personal Attendance in Global Firestore Sync**:
  - NEVER push personal student attendance payloads (`ATTENDANCE_UPDATED`, `LOGIN_EVENT`, credentials, subject marks) to the public Firestore sync document `config/sync`. Firestore sync is strictly reserved for global maintenance flags, announcements, and grading weights.
  - Cross-tab attendance synchronization is strictly scoped to local browser sessions via `BroadcastChannel('kl_portal_sync')` and local window events.
  - Subscriptions must enforce `event.data.studentId === currentStudentId` so one student's attendance update never overrides another student's view.
- **Primary Account vs Friend Profile Integrity**:
  - The primary user (`rememberedId`, `original_my_id`, or `id: 'main'`) MUST ALWAYS be identified as the Primary Account (`id: 'main'`, `isFriend: false`, green "Primary" badge).
  - The primary account must NEVER receive a "Friend" badge or be duplicated in the saved friends list.

---

## 4. Live Attendance Detection & Diffing Safeguards
- **In-Class Diff Thresholds**:
  - In `src/services/attendanceAlerts.js`, delta comparisons between attendance refreshes must only trigger a live in-class notification if the conducted/attended delta is small: `(effectiveConductedDiff <= 2 && effectiveAttendedDiff <= 2)`.
  - Deltas greater than 2 indicate initial sync, cache hydration, or full reload, NOT an in-class live attendance event.
- **Strict Absence Integrity**:
  - If any component or course absence is detected (`anyCompAbsent || wasCourseAbsent`), NEVER announce "Marked PRESENT". Alerts must strictly notify `⚠️ Marked ABSENT`.

---

## 5. User-Facing Error Sanitization
- **No Raw Technical Errors**:
  - Never display raw browser or network technical error messages (e.g. `"signal timed out"`, `"AbortError: The operation was aborted"`, `"Failed to fetch"`) in the UI.
  - Sanitize all timeout and network failures to clear, friendly copy: `"University ERP server took longer than expected to respond. Please try again or re-verify your session."`

---

## 6. ERP Candidate Resolution & Query Logic
- **Multi-Candidate Resolution**:
  - KL ERP stores past academic years under both legacy integer IDs and contemporary IDs (e.g., 2026-2027: `29`, `18`; 2025-2026: `28`, `17`, `19`, `18`; 2024-2025: `27`, `16`, `17`).
  - Always maintain candidate lists in `getCandidateYearIds` across `worker/index.js`, `server/server.js`, and `src/config/api.js`.
- **Never Break Courselist Loop Early on Empty Tables**:
  - When querying `courselist`, KL ERP may return an empty table containing `<div class="empty">No results found.</div>`.
  - The loop MUST check `!hasEmptyResult && (hasCourseCode || html.includes('Attendance'))` before breaking. If a table has `"No results found."`, continue testing remaining candidate year IDs so completed semesters are discovered and fetched properly.
- **Mutual Exclusion for Summer Term vs Term 3**:
  - Because KL ERP names the summer session `"Summer Term"`, pattern checks on `term` must NEVER match `"Summer Term"`.
  - Summer Term is strictly ID `3`, and Term 3 is strictly ID `4` with explicit exclusion of `'summer'`.
- **Session Priming**:
  - Always prime the ERP session via `searchgetinput` before querying `courselist` so the ERP session context is aligned with the requested year and semester.
- **Defensive Numeric Parsing**:
  - Always use `Number(data?.conducted) || 0` and `Number(data?.attended) || 0` to prevent string concatenation bugs and `NaN` in projection / bunk simulation calculations.

---

## 7. Semester Coverage & Term 3 / Summer Support
- Support all 4 semester types used across programs at KL University:
  - Odd Semester (`1`)
  - Even Semester (`2`)
  - Summer Term (`3`)
  - Tri Sem / Term 3 / Trimester (`4`)
- Maintain aliases for `Tri Sem`, `Trimester`, `Term 3`, `Term-3`, `Summer Term` across `src/config/api.js`, `src/services/erpService.js`, `worker/index.js`, and `server/server.js`.

---

## 8. Multi-Domain & Cloudflare Edge Architecture
- **Multi-Domain Production Fallback**:
  - The frontend operates across multiple live domains: `klattendancecalculator.web.app` (Firebase Hosting), `klattendance.online`, and `klattendance.in`.
  - On all non-localhost domains, API calls route seamlessly to the Cloudflare Edge Worker (`https://kl-attendance-api.yaswanthadithyareddy10.workers.dev`).
- **Defensive Abort Signals**:
  - Session init and captcha prewarming must incorporate defensive timeout abort signals (8-10 seconds) to prevent UI freezes when upstream university servers are under heavy load.

---

## 9. Mobile & Low-Spec Laptop Performance (Zero Lag)
- Avoid expensive CSS composite filters like `backdrop-blur-xl` layered on top of multiple `blur-3xl` ambient divs.
- Use solid `bg-white` card surfaces with hardware-accelerated transforms (`transform-gpu`) for 60fps rendering across all mobile devices and integrated-GPU laptops.

---

## 10. Future-Proof Resilience (Never Break in Coming Years)
- **Dynamic Academic Year Roll-Over**:
  - Never hardcode current year boundaries. Generate dynamic options (`startYear = month >= 5 ? currentYear : currentYear - 1; topYear = Math.max(startYear + 1, 2026)`).
  - Automatically calculate future candidate ERP IDs (`29 + (firstYear - 2026)` and `18 + (firstYear - 2026)`).
- **Crash Prevention via Global ErrorBoundary**:
  - The app must stay enclosed in `<ErrorBoundary>` to catch any runtime exceptions gracefully and offer instant 1-click reload/cache-clear buttons instead of white screens.
- **Safe Storage Access**:
  - Defensively guard `localStorage.setItem` in `try/catch` to handle iOS Safari private mode or full storage quotas without interrupting execution.


---

## 11. Fixed Sidebar & Independent Content Scroll (Zero Double Scrollbars)
- **Docked Pinned Left Sidebar**:
  - In all ERP portal layouts (`/attendance-register`, `/timetable`, `/grades`, `/bunk-simulator`, `/login`):
  - The left sidebar (`ErpSidebar`) must remain 100% fixed on the left (`h-full shrink-0 z-30`), while ONLY the right content area (`<main className="flex-1 overflow-y-auto min-h-0 ...">`) scrolls.
  - The outer application container takes `h-screen h-[100dvh] flex flex-col overflow-hidden` and suppresses the global website footer so the portal fits the exact viewport without double scrollbars.
  - Inside `ErpSidebar`, the Saved Accounts list has `flex-1 overflow-y-auto min-h-0` so it scrolls independently if there are many friends, while navigation and footer info remain pinned.

---

## 12. In-App Browser (Instagram) Compatibility & Safe CORS
- **No Wildcard CORS with Credentials**:
  - Cloudflare Edge Worker CORS (`getCorsHeaders`) must NEVER set `Access-Control-Allow-Origin: *` when credentials are included. Always resolve from `request.headers.get('Origin')` or `Referer`, and fall back to `'https://klattendancecalculator.web.app'` so strict WebKit (iOS Instagram WebView) does not reject API responses.
- **Instagram In-App Browser (IAB) Assistant**:
  - Detect Instagram WebView (`/Instagram|FBAN|FBAV|FB_IAB/i.test(navigator.userAgent)`).
  - Provide a direct Android intent link to open in Google Chrome (`intent://...#Intent;scheme=https;package=com.android.chrome;end`) and clear iOS guidance for Safari to ensure password autofill works seamlessly.
- **Defensive Captcha Cookie Mirroring**:
  - Mirror captcha cookies in `sessionStorage` (`kl_captcha_cookies`) so ephemeral in-app browser memory loss never invalidates the captcha session.

---

## 13. Bulletproof ERP Session Cookie & Captcha Lifecycle Invariants
- **Comma-Aware Cookie Parsing**:
  - KLU ERP combines multiple `Set-Cookie` headers into a comma-joined string (`PHPSESSID=..., _csrf=..., SERVERID=...`).
  - The cookie parser in both `worker/index.js` and `erpService.js` must explicitly handle both arrays and comma-separated Set-Cookie strings.
  - NEVER split purely on `;` without comma awareness; doing so drops `_csrf` and `SERVERID`, causing Yii2 CSRF verification to fail, regenerates the session, and invalidates the user's captcha code ("The verification code is incorrect").
- **Merge Cookies, Never Overwrite**:
  - In `src/services/erpService.js`, incoming cookies from responses must ALWAYS be merged into existing cookies using `mergeCookies(existing, incoming)`.
  - NEVER assign `inMemoryCaptchaCookies = sc` directly, which overwrites the entire cookie jar with partial cookies and deletes `PHPSESSID` or `_csrf`.
- **Direct Captcha Recovery (Self-Healing Session)**:
  - When `/api/session-init` returns a valid session with cookies and CSRF but empty `captchaUrl`, `erpService.getInitialState()` and `refreshCaptcha()` must immediately fetch the captcha image via `/index.php?r=site%2Fcaptcha` using the exact session cookies in < 120ms.
  - NEVER fall through to fetching `index.php` a second time, which creates an unnecessary second session and causes cookie/captcha mismatches.
- **Saved Profiles Strictly Captcha-Only**:
  - Saved accounts must strictly remain in **Captcha Only** mode.
  - Do NOT display sudden password entry cards or replace the captcha flow on saved profiles.
  - Password updates are managed via the dedicated edit pencil icon (`Edit2`) next to the profile badge.
- **Multi-Hop 302 Redirect Following**:
  - In `worker/index.js` (`/api/fast-login`), follow up to 5 redirect hops manually with accumulated cookies to reach the authenticated student portal (`/index.php?r=site%2Findexindi`).
  - Stopping after a single 302 redirect leaves an empty response body and fails session verification.

