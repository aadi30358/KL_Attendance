# Workspace Rules & Architecture Guidelines

Refer to [.agents/rules/erp_stability.md](file:///.agents/rules/erp_stability.md) for full guidelines.

### Summary of Critical Invariants:
1. **UI Cleanliness**:
   - No top switcher bar inside the Attendance Register dashboard card.
   - No `[Change Sem]` or `[Refresh]` button pills in the dashboard header.
   - In the "No Courses Found" empty state, only show `Change Academic Year / Semester`. Never add "Back to Present" buttons.
   - **Academic Year Dropdown**: Never show `(Completed)` or `(Present / Current)` tags. Show clean year strings only (e.g. `2026-2027`, `2025-2026`).
   - **Semester Dropdown**: Never show `(Sem 1)` or `(Sem 2)`. Show clean standard labels only (`Odd Sem`, `Even Sem`, `Summer Term`, `Tri Sem / Term 3`).
2. **ERP Candidate Resolution**:
   - Retain full candidate aliases for current (`2026-2027`: `29`, `18`) and past years (`2025-2026`: `28`, `17`, `19`, `18`; `2024-2025`: `27`, `16`, `17`).
   - Never break loops early on empty tables (`class="empty"` / `No results found`).
   - Strictly separate Summer Term (ID `3`) and Term 3 (ID `4`), preventing `s.text.includes('term')` from false matching "Summer Term".
   - Use defensive number coercion (`Number(...) || 0`) everywhere in attendance calculations.
3. **Semester Coverage**:
   - Fully support Odd (`1`), Even (`2`), Summer Term (`3`), and Tri Sem / Term 3 (`4`).
4. **Performance & Zero Lag**:
   - Do not use nested CPU-intensive backdrop blurs on top of heavy ambient blur divs on the selection card. Keep the card crisp `bg-white` with GPU transform acceleration so it never lags on mobile or laptops.
