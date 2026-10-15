# KL ERP Attendance Stability & Design Guardrails

## 1. UI Design Guardrails (Strict User Requirements)
- **NO Redundant Action Buttons in Dashboard Header**:
  - Do NOT re-add `[Change Sem]` or `[Refresh]` button pills to the dashboard header.
  - The semester name in the header subtitle (`${displayYearText} · ${displaySemesterText} Semester`) is clickable and invokes `handleBack()` cleanly.
- **NO Intrusive Buttons in Empty States**:
  - In the "No Courses Found" empty state, only show the single clean button: `Change Academic Year / Semester`.
  - NEVER re-add a button like `Back to Present (2025-2026 Even)` or any hardcoded redirect buttons inside the empty state.
- **NO In-Dashboard Session Switcher Bars**:
  - Do NOT place a custom year/semester switcher bar directly into the dashboard card view. The user wants the selection interface kept on the dedicated selection screen (`handleBack()`).
- **Academic Year Dropdown Labels**:
  - NEVER show `(Completed)`, `(Present / Current)`, or badges in academic year options.
  - Display strictly clean year strings: `2026-2027`, `2025-2026`, `2024-2025`, `2023-2024`, `2022-2023`, `2021-2022`.
- **Semester Dropdown Labels**:
  - NEVER show `(Sem 1)` or `(Sem 2)` in semester options.
  - Display strictly clean standard labels: `Odd Sem`, `Even Sem`, `Summer Term`, `Tri Sem / Term 3`.

## 2. ERP Attendance Fetching & Candidate Resolution
- **Multi-Candidate Resolution**:
  - KL ERP stores past academic years under both legacy integer IDs and contemporary IDs (e.g., 2026-2027: `29`, `18`; 2025-2026: `28`, `17`, `19`, `18`; 2024-2025: `27`, `16`, `17`).
  - Always maintain candidate lists in `getCandidateYearIds` across `worker/index.js`, `server/server.js`, and `src/config/api.js`.
- **Never Break Courselist Loop Early on Empty Tables**:
  - When querying `courselist`, KL ERP may return an empty table containing `<div class="empty">No results found.</div>`.
  - The loop MUST check `!hasEmptyResult && (hasCourseCode || html.includes('Attendance'))` before breaking. If a table has `"No results found."`, continue testing remaining candidate year IDs so completed semesters (e.g., 2025-2026, 2024-2025) are discovered and fetched properly.
- **Mutual Exclusion for Summer Term vs Term 3**:
  - Because KL ERP names the summer session `"Summer Term"`, pattern checks on `term` must NEVER match `"Summer Term"`.
  - Summer Term is strictly ID `3`, and Term 3 is strictly ID `4` with explicit exclusion of `'summer'`.
- **Session Priming**:
  - Always prime the ERP session via `searchgetinput` before querying `courselist` so the ERP session context is aligned with the requested year and semester.
- **Defensive Numeric Parsing**:
  - Always use `Number(data?.conducted) || 0` and `Number(data?.attended) || 0` to prevent string concatenation bugs and `NaN` in projection / bunk simulation calculations.

## 3. Semester Coverage & Term 3 / Summer Support
- Support all 4 semester types used across programs at KL University:
  - Odd Semester (`1`)
  - Even Semester (`2`)
  - Summer Term (`3`)
  - Tri Sem / Term 3 / Trimester (`4`)
- Maintain aliases for `Tri Sem`, `Trimester`, `Term 3`, `Term-3`, `Summer Term` across `src/config/api.js`, `src/services/erpService.js`, `worker/index.js`, and `server/server.js`.

## 4. Mobile & Low-Spec Laptop Performance (Zero Lag)
- Avoid expensive CSS composite filters like `backdrop-blur-xl` layered on top of multiple `blur-3xl` ambient divs.
- Use solid `bg-white` card surfaces with hardware-accelerated transforms (`transform-gpu`) for 60fps rendering across all mobile devices and integrated-GPU laptops.
