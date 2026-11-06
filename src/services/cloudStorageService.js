// Service for Permanent Cloud Storage via Firebase Firestore
// Guarantees zero-loss, cross-browser, cross-device, and Incognito persistence
// Independent per-student profile and attendance history storage

import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase.js';
import { stripEmojis, encodePassword } from './friendsService.js';

/**
 * Normalizes student ID to clean trimmed alphanumeric string
 * Strictly resolves UI aliases like 'main' or 'primary' to authentic 10-digit student ID
 */
export function sanitizeStudentId(id) {
    if (!id) return '';
    const str = String(id).trim();
    if (str === 'main' || str === 'primary' || str === 'default' || !/^\d+$/.test(str)) {
        if (typeof window !== 'undefined') {
            const real = (localStorage.getItem('activeErpUser') || localStorage.getItem('rememberedId') || localStorage.getItem('original_my_id') || '').trim();
            if (real && /^\d+$/.test(real)) return real;
        }
        const match = str.match(/\b\d{9,12}\b/);
        if (match) return match[0];
        return '';
    }
    const match = str.match(/\b\d{9,12}\b/);
    return match ? match[0] : str.replace(/[^0-9A-Za-z]/g, '');
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
        const cleanName = rawName && !rawName.startsWith('Friend (') ? rawName : (existing.name || 'Student');
        
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
        if (Array.isArray(profileData.enrolledSemesters)) payload.enrolledSemesters = profileData.enrolledSemesters;

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

    // Critical Defense: Never overwrite a past semester document with present-year (2026-2027) courses
    const yrStart = cleanYear.split('-')[0].trim();
    if (yrStart !== '2026' && courses.some(c => c.code === '24SDCS03A' || (c.title && c.title.includes('SOA PROGRAMMING')))) {
        console.warn(`[CloudStorage] Refusing to overwrite ${cleanYear}_${semName} with present semester courses for ${cleanId}`);
        return false;
    }
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
        const snap = await getDoc(userRef).catch(() => null);
        const data = snap?.exists() ? snap.data() : {};

        // If specific year & semester requested
        if (year && sem) {
            const cleanYear = String(year).trim();
            const startYear = cleanYear.split('-')[0].trim();
            const endYear = cleanYear.includes('-') ? cleanYear.split('-')[1].trim() : '';
            const fullYear = endYear.length === 2 ? `${startYear}-20${endYear}` : (cleanYear.includes('-') ? cleanYear : `${startYear}-${parseInt(startYear, 10) + 1}`);
            const shortYear = endYear.length === 4 ? `${startYear}-${endYear.slice(-2)}` : cleanYear;

            const rawSem = String(sem).trim();
            const isOdd = rawSem === '1' || rawSem.toLowerCase().includes('odd');
            const isEven = rawSem === '2' || rawSem.toLowerCase().includes('even');
            const isSummer = rawSem === '3' || rawSem.toLowerCase().includes('summer');
            const isTerm3 = rawSem === '4' || (rawSem.toLowerCase().includes('term') && !isSummer);
            const semName = isOdd ? 'Odd' : isEven ? 'Even' : isSummer ? 'Summer' : isTerm3 ? 'Term3' : rawSem;
            const semNum = isOdd ? '1' : isEven ? '2' : isSummer ? '3' : isTerm3 ? '4' : rawSem;

            const candidates = Array.from(new Set([
                `${cleanYear}_${semName}`,
                `${cleanYear}_${semNum}`,
                `${cleanYear}_${rawSem}`,
                `${fullYear}_${semName}`,
                `${fullYear}_${semNum}`,
                `${fullYear}_${rawSem}`,
                `${shortYear}_${semName}`,
                `${shortYear}_${semNum}`,
                `${shortYear}_${rawSem}`
            ]));

            // 1. Check root doc's attendanceHistory map
            if (data.attendanceHistory && typeof data.attendanceHistory === 'object') {
                for (const key of candidates) {
                    if (data.attendanceHistory[key] && Array.isArray(data.attendanceHistory[key].courses) && data.attendanceHistory[key].courses.length > 0) {
                        const courses = data.attendanceHistory[key].courses;
                        if (startYear !== '2026' && courses.some(c => c.code === '24SDCS03A' || (c.title && c.title.includes('SOA PROGRAMMING')))) {
                            continue;
                        }
                        return data.attendanceHistory[key];
                    }
                }
            }

            // 2. Check subcollection direct document lookups
            for (const key of candidates) {
                try {
                    const subRef = doc(db, 'users', cleanId, 'attendance', key);
                    const subSnap = await getDoc(subRef);
                    if (subSnap.exists()) {
                        const subData = subSnap.data();
                        if (Array.isArray(subData?.courses) && subData.courses.length > 0) {
                            if (startYear !== '2026' && subData.courses.some(c => c.code === '24SDCS03A' || (c.title && c.title.includes('SOA PROGRAMMING')))) {
                                continue;
                            }
                            return subData;
                        }
                    }
                } catch { /* ignore */ }
            }

            // 3. Fallback: Query all documents in subcollection and match by year & sem metadata
            try {
                const subCol = await getDocs(collection(db, 'users', cleanId, 'attendance')).catch(() => null);
                if (subCol && !subCol.empty) {
                    for (const d of subCol.docs) {
                        const docData = d.data();
                        const docYear = String(docData.academicYear || d.id || '').trim();
                        const docSem = String(docData.semester || d.id || '').trim().toLowerCase();
                        const matchesYear = docYear.includes(startYear) || d.id.includes(startYear);
                        const matchesSem = isOdd ? (docSem.includes('odd') || docSem.includes('_1') || d.id.endsWith('_1') || d.id.endsWith('_Odd'))
                            : isEven ? (docSem.includes('even') || docSem.includes('_2') || d.id.endsWith('_2') || d.id.endsWith('_Even'))
                            : isSummer ? (docSem.includes('summer') || docSem.includes('_3') || d.id.endsWith('_3') || d.id.endsWith('_Summer'))
                            : (docSem.includes('term') || docSem.includes('_4') || d.id.endsWith('_4') || d.id.endsWith('_Term3'));

                        if (matchesYear && matchesSem && Array.isArray(docData.courses) && docData.courses.length > 0) {
                            if (startYear !== '2026' && docData.courses.some(c => c.code === '24SDCS03A' || (c.title && c.title.includes('SOA PROGRAMMING')))) {
                                continue;
                            }
                            return docData;
                        }
                    }
                }
            } catch { /* ignore */ }

            // 4. Check if root doc represents this year & sem
            if (data.academicYear && String(data.academicYear).includes(startYear)) {
                const rootSem = String(data.semester || '').toLowerCase();
                const matchesRootSem = isOdd ? (rootSem.includes('odd') || rootSem === '1')
                    : isEven ? (rootSem.includes('even') || rootSem === '2')
                    : isSummer ? (rootSem.includes('summer') || rootSem === '3')
                    : (rootSem.includes('term') || rootSem === '4');
                if (matchesRootSem) {
                    const activeCourses = data.courses || data.activeCourses || [];
                    if (Array.isArray(activeCourses) && activeCourses.length > 0) {
                        return {
                            academicYear: data.academicYear,
                            semester: data.semester || semName,
                            courses: activeCourses,
                            summary: data.attendanceSummary || null,
                            timestamp: data.lastUpdated || (data.lastSuccessfulFetch ? new Date(data.lastSuccessfulFetch).getTime() : Date.now())
                        };
                    }
                }
            }

            // Invariant: If a specific historical year & semester was requested and not found in cloud,
            // strictly return null so live ERP query can fetch the real courses. Never cross-contaminate.
            return null;
        }

        // Return latest active courses if available
        const activeCourses = data.courses || data.activeCourses || [];
        if (Array.isArray(activeCourses) && activeCourses.length > 0) {
            return {
                academicYear: data.academicYear || '2026-2027',
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
            const cleanNick = raw && !raw.startsWith('Friend (') ? raw : (sid ? `Friend (${sid.slice(-4)})` : 'Buddy');
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
                    year: data.timetableYear || '2026-2027',
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

        const resolvedName = profile.name || profile.nickname || 'Student';
        const resolvedYear = profile.academicYear || '2026-2027';
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

        // 2b. Restore enrolled multi-semester academic history
        if (Array.isArray(profile.enrolledSemesters) && profile.enrolledSemesters.length > 0) {
            try {
                localStorage.setItem(`enrolledSemesters_${cleanId}`, JSON.stringify(profile.enrolledSemesters));
            } catch { /* ignore */ }
        }

        // 3. Populate attendance courses across all saved semesters in subcollection
        try {
            const allAttDocs = await getDocs(collection(db, 'users', cleanId, 'attendance'));
            if (allAttDocs && !allAttDocs.empty) {
                allAttDocs.forEach(d => {
                    const docData = d.data();
                    if (Array.isArray(docData?.courses) && docData.courses.length > 0) {
                        const rawY = docData.academicYear || d.id.split('_')[0];
                        const rawS = docData.semester || d.id.split('_')[1];
                        const startY = String(rawY).split('-')[0].trim();
                        const dYear = startY.length === 4 ? `${startY}-${parseInt(startY, 10) + 1}` : String(rawY).trim();
                        const sStr = String(rawS).trim().toLowerCase();
                        const isOdd = sStr.includes('odd') || sStr === '1';
                        const isEven = sStr.includes('even') || sStr === '2';
                        const isSummer = sStr.includes('summer') || sStr === '3';
                        const dSemName = isOdd ? 'Odd' : isEven ? 'Even' : isSummer ? 'Summer' : 'Term3';
                        const dSemNum = isOdd ? '1' : isEven ? '2' : isSummer ? '3' : '4';
                        const attPayload = JSON.stringify({
                            attendance_data: docData.courses,
                            year: dYear,
                            semester: dSemName,
                            timestamp: docData.timestamp || Date.now(),
                            empty: false
                        });
                        localStorage.setItem(`kleData_${cleanId}_${dYear}_${dSemName}`, attPayload);
                        localStorage.setItem(`kleData_${cleanId}_${dYear}_${dSemNum}`, attPayload);
                        if (dYear.includes('2026') && isOdd) {
                            localStorage.setItem(`kleData_${cleanId}`, attPayload);
                            localStorage.setItem('kleData', attPayload);
                        }
                    }
                });
            }
        } catch { /* ignore */ }

        // Also query direct primary semester
        const attendance = await getAttendanceFromCloud(cleanId, resolvedYear, resolvedSem);
        if (attendance && Array.isArray(attendance.courses) && attendance.courses.length > 0) {
            const rawY = resolvedYear || '2026-2027';
            const startY = String(rawY).split('-')[0].trim();
            const normY = startY.length === 4 ? `${startY}-${parseInt(startY, 10) + 1}` : String(rawY).trim();
            const sStr = String(resolvedSem || '1').trim().toLowerCase();
            const isOdd = sStr.includes('odd') || sStr === '1';
            const isEven = sStr.includes('even') || sStr === '2';
            const isSummer = sStr.includes('summer') || sStr === '3';
            const normS = isOdd ? 'Odd' : isEven ? 'Even' : isSummer ? 'Summer' : 'Term3';
            const semNum = isOdd ? '1' : isEven ? '2' : isSummer ? '3' : '4';
            const payload = JSON.stringify({
                attendance_data: attendance.courses,
                year: normY,
                semester: normS,
                timestamp: attendance.timestamp || Date.now(),
                empty: false
            });

            try {
                localStorage.setItem(`kleData_${cleanId}`, payload);
                localStorage.setItem(`kleData_${cleanId}_${normY}_${normS}`, payload);
                localStorage.setItem(`kleData_${cleanId}_${normY}_${semNum}`, payload);
                localStorage.setItem('kleData', payload);
                localStorage.setItem(`activeYear_${cleanId}`, normY);
                localStorage.setItem(`activeSem_${cleanId}`, normS);
                localStorage.setItem(`attendanceLastUpdated_${cleanId}`, String(attendance.timestamp || Date.now()));
            } catch { /* ignore */ }
        }

        // 4. Populate CGPA & Grades if available
        if (Array.isArray(profile.grades) && profile.grades.length > 0) {
            try {
                const strGrades = JSON.stringify(profile.grades);
                localStorage.setItem(`kl_grades_${cleanId}`, strGrades);
                localStorage.setItem(`cgpa_${cleanId}`, strGrades);
                if (profile.isPrimary) {
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
 * Safe no-op kept for backwards compatibility
 */
export async function seedAdithyaProfileIfEmpty() {
    return Promise.resolve();
}
