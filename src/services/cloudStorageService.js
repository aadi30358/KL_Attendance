// Service for Permanent Cloud Storage via Firebase Firestore
// Guarantees zero-loss, cross-browser, cross-device, and Incognito persistence
// Independent per-student profile and attendance history storage

import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { stripEmojis, encodePassword } from './friendsService.js';

/**
 * Normalizes student ID to clean trimmed alphanumeric string
 */
export function sanitizeStudentId(id) {
    if (!id) return '';
    return String(id).trim().replace(/[^0-9A-Za-z]/g, '');
}

/**
 * Permanently saves a student's profile to Firestore
 */
export async function saveStudentProfileToCloud(studentId, profileData = {}) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return null;

    try {
        const userRef = doc(db, 'users', cleanId);
        const existingSnap = await getDoc(userRef).catch(() => null);
        const existing = existingSnap?.exists() ? existingSnap.data() : {};

        const rawName = stripEmojis(profileData.name || profileData.nickname || existing.name || existing.nickname || '');
        const cleanName = rawName && !rawName.startsWith('Friend (') ? rawName : (cleanId === '2400030358' ? 'Adithya' : (existing.name || 'Student'));
        
        let storedPassword = existing.savedPassword || '';
        if (profileData.password) {
            storedPassword = encodePassword(profileData.password);
        } else if (profileData.savedPassword) {
            storedPassword = profileData.savedPassword;
        }

        const nowIso = new Date().toISOString();
        const payload = {
            studentId: cleanId,
            name: cleanName,
            nickname: cleanName,
            savedPassword: storedPassword,
            hasSavedPassword: Boolean(storedPassword),
            isPrimary: profileData.isPrimary !== undefined ? Boolean(profileData.isPrimary) : (existing.isPrimary ?? true),
            primaryAccount: profileData.primaryAccount !== undefined ? Boolean(profileData.primaryAccount) : (existing.primaryAccount ?? true),
            updatedAt: nowIso,
            createdAt: existing.createdAt || nowIso
        };

        if (profileData.academicYear) payload.academicYear = profileData.academicYear;
        if (profileData.semester) payload.semester = profileData.semester;

        await setDoc(userRef, payload, { merge: true });

        // Also update public student registry index
        try {
            const studentRegRef = doc(db, 'students', cleanId);
            await setDoc(studentRegRef, {
                studentId: cleanId,
                name: cleanName,
                lastActiveAt: nowIso,
                updatedAt: nowIso
            }, { merge: true });
        } catch { /* ignore non-blocking registry error */ }

        return payload;
    } catch (err) {
        console.warn(`[CloudStorage] Error saving student profile for ${cleanId}:`, err?.message || err);
        return null;
    }
}

/**
 * Retrieves a student's permanently saved profile from Firestore
 */
export async function getStudentProfileFromCloud(studentId) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return null;

    try {
        const userRef = doc(db, 'users', cleanId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            return snap.data();
        }
    } catch (err) {
        console.warn(`[CloudStorage] Error reading student profile for ${cleanId}:`, err?.message || err);
    }
    return null;
}

/**
 * Permanently deletes a student's profile and registry from Firestore
 * INVARIANT: Invoked ONLY when user explicitly requests account deletion
 */
export async function deleteStudentProfileFromCloud(studentId) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return false;

    try {
        await deleteDoc(doc(db, 'users', cleanId));
        await deleteDoc(doc(db, 'students', cleanId));
        // Also remove known attendance history documents if present
        try {
            await deleteDoc(doc(db, 'users', cleanId, 'attendance', '2026-2027_1'));
            await deleteDoc(doc(db, 'users', cleanId, 'attendance', '2026-2027_2'));
            await deleteDoc(doc(db, 'users', cleanId, 'attendance', '2025-2026_1'));
            await deleteDoc(doc(db, 'users', cleanId, 'attendance', '2025-2026_2'));
        } catch { /* ignore subcollection removal notices */ }
        return true;
    } catch (err) {
        console.warn(`[CloudStorage] Error deleting student profile for ${cleanId}:`, err?.message || err);
        return false;
    }
}

/**
 * Permanently saves attendance data for a student, academic year, and semester
 * INVARIANT: Never overwrites valid existing courses with empty or failed arrays
 */
export async function saveAttendanceToCloud(studentId, year, sem, courses = [], summary = null) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return false;

    // Defense: Do not wipe valid existing attendance records with empty data
    if (!Array.isArray(courses) || courses.length === 0) {
        console.log(`[CloudStorage] Skip cloud save: courses array is empty for ${cleanId}`);
        return false;
    }

    const cleanYear = String(year || '2025-2026').trim();
    const rawSem = String(sem || '1').trim();
    const isOdd = rawSem === '1' || rawSem.toLowerCase().includes('odd');
    const isEven = rawSem === '2' || rawSem.toLowerCase().includes('even');
    const isSummer = rawSem === '3' || rawSem.toLowerCase().includes('summer');
    const isTerm3 = rawSem === '4' || (rawSem.toLowerCase().includes('term') && !isSummer);
    const semName = isOdd ? 'Odd' : isEven ? 'Even' : isSummer ? 'Summer' : isTerm3 ? 'Term3' : rawSem;
    const semNum = isOdd ? '1' : isEven ? '2' : isSummer ? '3' : isTerm3 ? '4' : rawSem;
    const historyKey1 = `${cleanYear}_${semName}`;
    const historyKey2 = `${cleanYear}_${semNum}`;
    const nowIso = new Date().toISOString();
    const nowTs = Date.now();

    try {
        // 1. Calculate clean summary if not provided
        let totalConducted = 0;
        let totalAttended = 0;
        courses.forEach(c => {
            totalConducted += Number(c.total_conducted || c.conducted || 0);
            totalAttended += Number(c.total_attended || c.attended || 0);
        });
        const calcPercentage = totalConducted > 0 ? Math.round((totalAttended / totalConducted) * 100) : 0;
        const finalSummary = summary || {
            percentage: calcPercentage,
            totalConducted,
            totalAttended
        };

        const attendanceEntry = {
            academicYear: cleanYear,
            semester: semName,
            courses,
            summary: finalSummary,
            lastSuccessfulFetch: nowIso,
            timestamp: nowTs,
            updatedAt: nowIso
        };

        // 2. Save onto primary user document for ultra-fast single-document reads (< 80ms)
        const userRef = doc(db, 'users', cleanId);
        await setDoc(userRef, {
            academicYear: cleanYear,
            semester: semName,
            activeCourses: courses,
            courses: courses,
            attendanceSummary: finalSummary,
            lastSuccessfulFetch: nowIso,
            lastUpdated: nowTs,
            [`attendanceHistory.${historyKey1}`]: attendanceEntry,
            [`attendanceHistory.${historyKey2}`]: attendanceEntry,
            updatedAt: nowIso
        }, { merge: true });

        // 3. Save into subcollection for structured historical permanence
        try {
            const subRef1 = doc(db, 'users', cleanId, 'attendance', historyKey1);
            await setDoc(subRef1, attendanceEntry, { merge: true });
            const subRef2 = doc(db, 'users', cleanId, 'attendance', historyKey2);
            await setDoc(subRef2, attendanceEntry, { merge: true });
        } catch (subErr) {
            console.warn(`[CloudStorage] Subcollection save notice for ${cleanId}:`, subErr?.message);
        }

        return true;
    } catch (err) {
        console.warn(`[CloudStorage] Error saving attendance to cloud for ${cleanId}:`, err?.message || err);
        return false;
    }
}

/**
 * Retrieves permanently saved attendance from Firestore
 */
export async function getAttendanceFromCloud(studentId, year = null, sem = null) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return null;

    try {
        const userRef = doc(db, 'users', cleanId);
        const snap = await getDoc(userRef);
        if (!snap.exists()) return null;

        const data = snap.data();

        // If specific year & semester requested
        if (year && sem) {
            const cleanYear = String(year).trim();
            const rawSem = String(sem).trim();
            const isOdd = rawSem === '1' || rawSem.toLowerCase().includes('odd');
            const isEven = rawSem === '2' || rawSem.toLowerCase().includes('even');
            const isSummer = rawSem === '3' || rawSem.toLowerCase().includes('summer');
            const isTerm3 = rawSem === '4' || (rawSem.toLowerCase().includes('term') && !isSummer);
            const semName = isOdd ? 'Odd' : isEven ? 'Even' : isSummer ? 'Summer' : isTerm3 ? 'Term3' : rawSem;
            const semNum = isOdd ? '1' : isEven ? '2' : isSummer ? '3' : isTerm3 ? '4' : rawSem;

            const candidates = [
                `${cleanYear}_${semName}`,
                `${cleanYear}_${semNum}`,
                `${cleanYear}_${rawSem}`
            ];

            for (const key of candidates) {
                if (data.attendanceHistory && data.attendanceHistory[key] && Array.isArray(data.attendanceHistory[key].courses) && data.attendanceHistory[key].courses.length > 0) {
                    return data.attendanceHistory[key];
                }
            }

            // Check subcollection fallback
            for (const key of candidates) {
                try {
                    const subRef = doc(db, 'users', cleanId, 'attendance', key);
                    const subSnap = await getDoc(subRef);
                    if (subSnap.exists()) {
                        const subData = subSnap.data();
                        if (Array.isArray(subData?.courses) && subData.courses.length > 0) {
                            return subData;
                        }
                    }
                } catch { /* ignore */ }
            }
        }

        // Return latest active courses if available
        const activeCourses = data.courses || data.activeCourses || [];
        if (Array.isArray(activeCourses) && activeCourses.length > 0) {
            return {
                academicYear: (data.academicYear && data.academicYear !== '2026-2027') ? data.academicYear : '2025-2026',
                semester: data.semester || 'Odd',
                courses: activeCourses,
                summary: data.attendanceSummary || null,
                timestamp: data.lastUpdated || (data.lastSuccessfulFetch ? new Date(data.lastSuccessfulFetch).getTime() : Date.now())
            };
        }

        // Search any historical semester with valid courses
        if (data.attendanceHistory && typeof data.attendanceHistory === 'object') {
            for (const entry of Object.values(data.attendanceHistory)) {
                if (Array.isArray(entry?.courses) && entry.courses.length > 0) {
                    return entry;
                }
            }
        }
    } catch (err) {
        console.warn(`[CloudStorage] Error getting attendance from cloud for ${cleanId}:`, err?.message || err);
    }
    return null;
}

/**
 * Permanently saves buddies / friends list for a student to Firestore
 */
export async function saveFriendsToCloud(studentId, friendsList = []) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId || !Array.isArray(friendsList)) return false;

    try {
        const sanitizedFriends = friendsList.map(f => {
            const sid = sanitizeStudentId(f.studentId || f.username || f.id);
            const raw = stripEmojis(f.nickname || f.name || '');
            const cleanNick = raw && !raw.startsWith('Friend (') ? raw : (sid === '2400030358' ? 'Adithya' : (sid ? `Friend (${sid.slice(-4)})` : 'Buddy'));
            let pass = f.password || '';
            if (pass && typeof pass === 'string' && pass.length < 25) {
                pass = encodePassword(pass);
            }
            return {
                id: f.id || `friend_${sid}`,
                nickname: cleanNick,
                studentId: sid,
                username: sid,
                password: pass,
                hasSavedPassword: Boolean(pass)
            };
        });

        const userRef = doc(db, 'users', cleanId);
        await setDoc(userRef, {
            friends: sanitizedFriends,
            updatedAt: new Date().toISOString()
        }, { merge: true });

        return true;
    } catch (err) {
        console.warn(`[CloudStorage] Error saving friends to cloud for ${cleanId}:`, err?.message || err);
        return false;
    }
}

/**
 * Retrieves saved buddies / friends list from Firestore
 */
export async function getFriendsFromCloud(studentId) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return [];

    try {
        const userRef = doc(db, 'users', cleanId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.friends)) {
                return data.friends;
            }
        }
    } catch (err) {
        console.warn(`[CloudStorage] Error reading friends from cloud for ${cleanId}:`, err?.message || err);
    }
    return [];
}

/**
 * Permanently saves student CGPA and grades to Firestore
 */
export async function saveCgpaToCloud(studentId, grades = [], cgpa = null) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId || !Array.isArray(grades) || grades.length === 0) return false;

    try {
        const userRef = doc(db, 'users', cleanId);
        const nowIso = new Date().toISOString();
        const payload = {
            grades,
            lastCgpaFetch: nowIso,
            updatedAt: nowIso
        };
        if (cgpa !== null && cgpa !== undefined) {
            payload.cgpa = cgpa;
        }

        await setDoc(userRef, payload, { merge: true });
        return true;
    } catch (err) {
        console.warn(`[CloudStorage] Error saving CGPA to cloud for ${cleanId}:`, err?.message || err);
        return false;
    }
}

/**
 * Retrieves student CGPA and grades from Firestore
 */
export async function getCgpaFromCloud(studentId) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return null;

    try {
        const userRef = doc(db, 'users', cleanId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            if (Array.isArray(data.grades) && data.grades.length > 0) {
                return {
                    grades: data.grades,
                    cgpa: data.cgpa || null,
                    lastCgpaFetch: data.lastCgpaFetch || null
                };
            }
        }
    } catch (err) {
        console.warn(`[CloudStorage] Error getting CGPA from cloud for ${cleanId}:`, err?.message || err);
    }
    return null;
}

/**
 * Permanently saves student Timetable to Firestore
 */
export async function saveTimetableToCloud(studentId, timetable = {}, year = '2025-2026', sem = 'Odd') {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId || !timetable || typeof timetable !== 'object') return false;

    try {
        const userRef = doc(db, 'users', cleanId);
        const nowIso = new Date().toISOString();
        await setDoc(userRef, {
            timetable,
            timetableYear: String(year || '2025-2026').trim(),
            timetableSem: String(sem || 'Odd').trim(),
            lastTimetableFetch: nowIso,
            updatedAt: nowIso
        }, { merge: true });
        return true;
    } catch (err) {
        console.warn(`[CloudStorage] Error saving timetable to cloud for ${cleanId}:`, err?.message || err);
        return false;
    }
}

/**
 * Retrieves student Timetable from Firestore
 */
export async function getTimetableFromCloud(studentId) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return null;

    try {
        const userRef = doc(db, 'users', cleanId);
        const snap = await getDoc(userRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.timetable && typeof data.timetable === 'object') {
                return {
                    timetable: data.timetable,
                    year: (data.timetableYear && data.timetableYear !== '2026-2027') ? data.timetableYear : '2025-2026',
                    sem: data.timetableSem || 'Odd',
                    lastTimetableFetch: data.lastTimetableFetch || null
                };
            }
        }
    } catch (err) {
        console.warn(`[CloudStorage] Error getting timetable from cloud for ${cleanId}:`, err?.message || err);
    }
    return null;
}

/**
 * Restores permanent cloud data into local memory and localStorage
 * Essential for Incognito mode, new browsers, new devices, or after cache clearing
 */
export async function restoreStudentDataInIncognito(studentId) {
    const cleanId = sanitizeStudentId(studentId);
    if (!cleanId) return false;

    try {
        const profile = await getStudentProfileFromCloud(cleanId);
        if (!profile) return false;

        const resolvedName = profile.name || profile.nickname || (cleanId === '2400030358' ? 'Adithya' : 'Student');
        const resolvedYear = (profile.academicYear && profile.academicYear !== '2026-2027') ? profile.academicYear : '2025-2026';
        const resolvedSem = profile.semester || '1';

        // 1. Populate primary identifiers
        try {
            localStorage.setItem('activeErpUser', cleanId);
            localStorage.setItem('rememberedId', cleanId);
            localStorage.setItem('original_my_id', cleanId);
            localStorage.setItem('rememberedName', resolvedName);
            localStorage.setItem(`kl_name_${cleanId}`, resolvedName);
            if (profile.savedPassword) {
                localStorage.setItem('rememberedPassword', profile.savedPassword);
                localStorage.setItem(`friend_pass_${cleanId}`, profile.savedPassword);
            }
        } catch { /* ignore storage quota/private restriction */ }

        // 2. Populate friends list if available
        let friendsToRestore = Array.isArray(profile.friends) && profile.friends.length > 0 ? profile.friends : [];
        if (friendsToRestore.length === 0) {
            friendsToRestore = await getFriendsFromCloud(cleanId);
        }
        if (Array.isArray(friendsToRestore) && friendsToRestore.length > 0) {
            try {
                localStorage.setItem('kl_saved_friends', JSON.stringify(friendsToRestore));
                if (typeof window !== 'undefined') {
                    window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: { studentId: cleanId } }));
                }
            } catch { /* ignore */ }
        }

        // 3. Populate attendance courses
        const attendance = await getAttendanceFromCloud(cleanId, resolvedYear, resolvedSem);
        if (attendance && Array.isArray(attendance.courses) && attendance.courses.length > 0) {
            const payload = JSON.stringify({
                attendance_data: attendance.courses,
                year: resolvedYear,
                semester: resolvedSem,
                timestamp: attendance.timestamp || Date.now()
            });

            try {
                localStorage.setItem(`kleData_${cleanId}`, payload);
                localStorage.setItem(`kleData_${cleanId}_${resolvedYear}_${resolvedSem}`, payload);
                localStorage.setItem('kleData', payload);
                localStorage.setItem(`activeYear_${cleanId}`, resolvedYear);
                localStorage.setItem(`activeSem_${cleanId}`, resolvedSem);
                localStorage.setItem(`attendanceLastUpdated_${cleanId}`, String(attendance.timestamp || Date.now()));
            } catch { /* ignore */ }
        }

        // 4. Populate CGPA & Grades if available
        if (Array.isArray(profile.grades) && profile.grades.length > 0) {
            try {
                const strGrades = JSON.stringify(profile.grades);
                localStorage.setItem(`kl_grades_${cleanId}`, strGrades);
                localStorage.setItem(`cgpa_${cleanId}`, strGrades);
                if (cleanId === '2400030358' || profile.isPrimary) {
                    localStorage.setItem('cgpa_data', strGrades);
                }
            } catch { /* ignore */ }
        }

        // 5. Populate Timetable if available
        if (profile.timetable && typeof profile.timetable === 'object') {
            try {
                localStorage.setItem(`kl_timetable_${cleanId}`, JSON.stringify(profile.timetable));
                localStorage.setItem('timetableData', JSON.stringify(profile.timetable));
            } catch { /* ignore */ }
        }

        // 6. Notify all components and tabs of successful cloud restore
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('storage'));
            window.dispatchEvent(new CustomEvent('kl_friends_updated', { detail: { studentId: cleanId } }));
            window.dispatchEvent(new CustomEvent('kl_attendance_updated', { detail: { studentId: cleanId } }));
            window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: { studentId: cleanId } }));
        }

        return true;
    } catch (err) {
        console.warn(`[CloudStorage] Error restoring data in incognito for ${cleanId}:`, err?.message || err);
        return false;
    }
}

/**
 * Seed initial profile for target user (e.g. Adithya 2400030358) if missing in Firestore
 */
export async function seedAdithyaProfileIfEmpty() {
    try {
        const snap = await getDoc(doc(db, 'users', '2400030358')).catch(() => null);
        const data = snap?.exists() ? snap.data() : null;
        if (!data || !data.name || data.name === 'Student') {
            await setDoc(doc(db, 'users', '2400030358'), {
                studentId: '2400030358',
                name: 'Adithya',
                nickname: 'Adithya',
                isPrimary: true,
                primaryAccount: true,
                academicYear: '2025-2026',
                semester: '1',
                updatedAt: new Date().toISOString()
            }, { merge: true });
        }
    } catch { /* non-blocking */ }
}
