import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure persistent data directory exists
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) {
    try {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
        console.warn('[Database] Notice creating data dir:', e.message);
    }
}

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
if (!fs.existsSync(BACKUP_DIR)) {
    try {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    } catch (e) {
        console.warn('[Database] Notice creating backup dir:', e.message);
    }
}

const DB_PATH = process.env.DB_PATH || path.join(DATA_DIR, 'kl_attendance.db');

let dbInstance = null;

export function getDatabase() {
    if (dbInstance) return dbInstance;

    try {
        console.log(`[Database] Connecting to SQLite persistent database at: ${DB_PATH}`);
        dbInstance = new DatabaseSync(DB_PATH);
        
        // Enable WAL mode for concurrent read/write performance and foreign keys
        dbInstance.exec('PRAGMA journal_mode = WAL;');
        dbInstance.exec('PRAGMA foreign_keys = ON;');
        dbInstance.exec('PRAGMA busy_timeout = 5000;');

        // Run automated schema migrations
        runMigrations(dbInstance);

        return dbInstance;
    } catch (err) {
        console.error('[Database] Failed to initialize SQLite database:', err);
        throw err;
    }
}

function runMigrations(db) {
    db.exec(`
        -- Users table
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            display_name TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            last_login_at TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

        -- ERP Account Connections & Authorization Status
        CREATE TABLE IF NOT EXISTS erp_connections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            is_connected INTEGER DEFAULT 1,
            auth_status TEXT DEFAULT 'connected',
            sync_status TEXT DEFAULT 'synced',
            last_authorized_at TEXT,
            last_synced_at TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_erp_conn_user ON erp_connections(user_id);

        -- Timetable Records (associated with user, academic year, and semester)
        CREATE TABLE IF NOT EXISTS timetables (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            semester TEXT NOT NULL,
            timetable_json TEXT NOT NULL,
            source TEXT DEFAULT 'erp_live',
            last_synced_at TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, academic_year, semester),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_timetables_user_year_sem ON timetables(user_id, academic_year, semester);

        -- CGPA and Academic Summary Records
        CREATE TABLE IF NOT EXISTS cgpa_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL UNIQUE,
            cgpa REAL,
            total_credits REAL,
            courses_json TEXT NOT NULL,
            source TEXT DEFAULT 'erp_live',
            last_synced_at TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_cgpa_user ON cgpa_records(user_id);

        -- Attendance Records (associated with user, academic year, and semester)
        CREATE TABLE IF NOT EXISTS attendance_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            academic_year TEXT NOT NULL,
            semester TEXT NOT NULL,
            attendance_json TEXT NOT NULL,
            summary_json TEXT,
            last_synced_at TEXT DEFAULT (datetime('now')),
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT DEFAULT (datetime('now')),
            UNIQUE(user_id, academic_year, semester),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_attendance_user_year_sem ON attendance_records(user_id, academic_year, semester);

        -- Synchronization History & Audit Log
        CREATE TABLE IF NOT EXISTS sync_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            sync_type TEXT NOT NULL,
            status TEXT NOT NULL,
            message TEXT,
            synced_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );
        CREATE INDEX IF NOT EXISTS idx_sync_history_user ON sync_history(user_id);
    `);
    console.log('[Database] Schema migrations applied successfully.');
}

/**
 * Clean student ID helper
 */
function cleanId(id) {
    return String(id || '').trim();
}

/**
 * Upsert User profile
 */
export function upsertUser(userId, username, displayName = null) {
    const db = getDatabase();
    const uid = cleanId(userId);
    const uname = cleanId(username) || uid;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO users (id, username, display_name, last_login_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            username = excluded.username,
            display_name = COALESCE(excluded.display_name, users.display_name),
            last_login_at = excluded.last_login_at,
            updated_at = excluded.updated_at
    `);
    stmt.run(uid, uname, displayName, now, now);

    // Also ensure ERP connection record exists
    const connStmt = db.prepare(`
        INSERT INTO erp_connections (user_id, is_connected, auth_status, sync_status, last_authorized_at, last_synced_at, updated_at)
        VALUES (?, 1, 'connected', 'synced', ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            is_connected = 1,
            auth_status = 'connected',
            last_authorized_at = excluded.last_authorized_at,
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at
    `);
    connStmt.run(uid, now, now, now);
}

/**
 * Upsert Timetable for a user, academic year, and semester
 */
export function saveTimetable(userId, academicYear, semester, timetableData, source = 'erp_live') {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid || !academicYear || !semester || !timetableData) return false;

    upsertUser(uid, uid);

    const year = String(academicYear).trim();
    const sem = String(semester).trim();
    const jsonStr = typeof timetableData === 'string' ? timetableData : JSON.stringify(timetableData);
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO timetables (user_id, academic_year, semester, timetable_json, source, last_synced_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, academic_year, semester) DO UPDATE SET
            timetable_json = excluded.timetable_json,
            source = excluded.source,
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at
    `);
    stmt.run(uid, year, sem, jsonStr, source, now, now);

    recordSync(uid, 'timetable', 'success', `Timetable saved for ${year} ${sem}`);
    return true;
}

/**
 * Get saved timetable for user, academic year, and semester
 */
export function getTimetable(userId, academicYear = null, semester = null) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid) return null;

    if (academicYear && semester) {
        const stmt = db.prepare(`
            SELECT * FROM timetables
            WHERE user_id = ? AND academic_year = ? AND semester = ?
            ORDER BY updated_at DESC LIMIT 1
        `);
        const row = stmt.get(uid, String(academicYear).trim(), String(semester).trim());
        if (row) {
            try {
                return {
                    ...row,
                    timetable: JSON.parse(row.timetable_json)
                };
            } catch {
                return null;
            }
        }
    }

    // If specific term not found or not specified, fetch latest saved timetable
    const fallbackStmt = db.prepare(`
        SELECT * FROM timetables
        WHERE user_id = ?
        ORDER BY updated_at DESC LIMIT 1
    `);
    const fallbackRow = fallbackStmt.get(uid);
    if (fallbackRow) {
        try {
            return {
                ...fallbackRow,
                timetable: JSON.parse(fallbackRow.timetable_json)
            };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Get all saved timetables for a user
 */
export function getAllTimetablesForUser(userId) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid) return [];

    const stmt = db.prepare(`
        SELECT academic_year, semester, timetable_json, source, last_synced_at, updated_at
        FROM timetables
        WHERE user_id = ?
        ORDER BY updated_at DESC
    `);
    const rows = stmt.all(uid);
    return rows.map(r => {
        try {
            return { ...r, timetable: JSON.parse(r.timetable_json) };
        } catch {
            return null;
        }
    }).filter(Boolean);
}

/**
 * Upsert CGPA and courses history for a user
 */
export function saveCgpa(userId, cgpa, totalCredits, courses, source = 'erp_live') {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid || !courses) return false;

    upsertUser(uid, uid);

    const jsonStr = typeof courses === 'string' ? courses : JSON.stringify(courses);
    const numCgpa = parseFloat(cgpa) || null;
    const numCredits = parseFloat(totalCredits) || null;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO cgpa_records (user_id, cgpa, total_credits, courses_json, source, last_synced_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            cgpa = COALESCE(excluded.cgpa, cgpa_records.cgpa),
            total_credits = COALESCE(excluded.total_credits, cgpa_records.total_credits),
            courses_json = excluded.courses_json,
            source = excluded.source,
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at
    `);
    stmt.run(uid, numCgpa, numCredits, jsonStr, source, now, now);

    recordSync(uid, 'cgpa', 'success', `CGPA ${numCgpa ?? 'saved'} with ${Array.isArray(courses) ? courses.length : 0} courses`);
    return true;
}

/**
 * Get saved CGPA and courses for a user
 */
export function getCgpa(userId) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid) return null;

    const stmt = db.prepare(`
        SELECT * FROM cgpa_records
        WHERE user_id = ?
        ORDER BY updated_at DESC LIMIT 1
    `);
    const row = stmt.get(uid);
    if (row) {
        try {
            return {
                ...row,
                courses: JSON.parse(row.courses_json)
            };
        } catch {
            return null;
        }
    }
    return null;
}

/**
 * Upsert Attendance records for user, academic year, and semester
 */
export function saveAttendance(userId, academicYear, semester, attendanceData, summaryData = null) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid || !academicYear || !semester || !attendanceData) return false;

    upsertUser(uid, uid);

    const year = String(academicYear).trim();
    const sem = String(semester).trim();
    const jsonStr = typeof attendanceData === 'string' ? attendanceData : JSON.stringify(attendanceData);
    const sumStr = summaryData ? (typeof summaryData === 'string' ? summaryData : JSON.stringify(summaryData)) : null;
    const now = new Date().toISOString();

    const stmt = db.prepare(`
        INSERT INTO attendance_records (user_id, academic_year, semester, attendance_json, summary_json, last_synced_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, academic_year, semester) DO UPDATE SET
            attendance_json = excluded.attendance_json,
            summary_json = COALESCE(excluded.summary_json, attendance_records.summary_json),
            last_synced_at = excluded.last_synced_at,
            updated_at = excluded.updated_at
    `);
    stmt.run(uid, year, sem, jsonStr, sumStr, now, now);

    recordSync(uid, 'attendance', 'success', `Attendance updated for ${year} ${sem}`);
    return true;
}

/**
 * Get saved attendance for user, academic year, and semester
 */
export function getAttendance(userId, academicYear = null, semester = null) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid) return null;

    if (academicYear && semester) {
        const stmt = db.prepare(`
            SELECT * FROM attendance_records
            WHERE user_id = ? AND academic_year = ? AND semester = ?
            ORDER BY updated_at DESC LIMIT 1
        `);
        const row = stmt.get(uid, String(academicYear).trim(), String(semester).trim());
        if (row) {
            try {
                return {
                    ...row,
                    attendance: JSON.parse(row.attendance_json),
                    summary: row.summary_json ? JSON.parse(row.summary_json) : null
                };
            } catch {
                return null;
            }
        }
    }

    // Fallback: latest saved attendance
    const fallbackStmt = db.prepare(`
        SELECT * FROM attendance_records
        WHERE user_id = ?
        ORDER BY updated_at DESC LIMIT 1
    `);
    const fallbackRow = fallbackStmt.get(uid);
    if (fallbackRow) {
        try {
            return {
                ...fallbackRow,
                attendance: JSON.parse(fallbackRow.attendance_json),
                summary: fallbackRow.summary_json ? JSON.parse(fallbackRow.summary_json) : null
            };
        } catch {
            return null;
        }
    }

    return null;
}

/**
 * Record sync history
 */
export function recordSync(userId, syncType, status, message = null) {
    try {
        const db = getDatabase();
        const uid = cleanId(userId);
        if (!uid) return;

        const stmt = db.prepare(`
            INSERT INTO sync_history (user_id, sync_type, status, message, synced_at)
            VALUES (?, ?, ?, ?, datetime('now'))
        `);
        stmt.run(uid, syncType, status, message);
    } catch (e) {
        console.warn('[Database] Record sync notice:', e.message);
    }
}

/**
 * Disconnect ERP account with optional data retention / deletion policy
 */
export function disconnectErp(userId, deleteData = false) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid) return false;

    if (deleteData) {
        // Explicit user request to delete all saved academic data
        db.exec('BEGIN TRANSACTION;');
        try {
            db.prepare('DELETE FROM timetables WHERE user_id = ?').run(uid);
            db.prepare('DELETE FROM cgpa_records WHERE user_id = ?').run(uid);
            db.prepare('DELETE FROM attendance_records WHERE user_id = ?').run(uid);
            db.prepare('DELETE FROM sync_history WHERE user_id = ?').run(uid);
            db.prepare(`
                UPDATE erp_connections 
                SET is_connected = 0, auth_status = 'disconnected', sync_status = 'deleted', updated_at = datetime('now')
                WHERE user_id = ?
            `).run(uid);
            db.exec('COMMIT;');
            console.log(`[Database] Disconnected ERP and deleted records for student: ${uid}`);
            return true;
        } catch (err) {
            db.exec('ROLLBACK;');
            console.error('[Database] Disconnect error:', err);
            return false;
        }
    } else {
        // Normal disconnect: keeps saved data, just revokes active session status
        db.prepare(`
            UPDATE erp_connections 
            SET is_connected = 0, auth_status = 'disconnected', sync_status = 'idle', updated_at = datetime('now')
            WHERE user_id = ?
        `).run(uid);
        return true;
    }
}

/**
 * Record user application logout without deleting data
 */
export function recordLogout(userId) {
    const db = getDatabase();
    const uid = cleanId(userId);
    if (!uid) return;
    try {
        db.prepare(`
            UPDATE erp_connections 
            SET auth_status = 'logged_out', updated_at = datetime('now')
            WHERE user_id = ?
        `).run(uid);
        recordSync(uid, 'session', 'success', 'User logged out of application session');
    } catch { /* ignore */ }
}

/**
 * Get full user academic profile
 */
export function getFullUserProfile(userId, academicYear = null, semester = null) {
    const uid = cleanId(userId);
    if (!uid) return null;

    const db = getDatabase();
    const userStmt = db.prepare('SELECT * FROM users WHERE id = ?');
    const user = userStmt.get(uid);

    const connStmt = db.prepare('SELECT * FROM erp_connections WHERE user_id = ?');
    const conn = connStmt.get(uid);

    const timetable = getTimetable(uid, academicYear, semester);
    const allTimetables = getAllTimetablesForUser(uid);
    const cgpa = getCgpa(uid);
    const attendance = getAttendance(uid, academicYear, semester);

    return {
        user: user || { id: uid, username: uid },
        connection: conn || { is_connected: 0, auth_status: 'disconnected' },
        timetable: timetable?.timetable || null,
        timetable_meta: timetable ? {
            academic_year: timetable.academic_year,
            semester: timetable.semester,
            last_synced_at: timetable.last_synced_at,
            source: timetable.source
        } : null,
        all_timetables: allTimetables,
        cgpa: cgpa?.cgpa ?? null,
        total_credits: cgpa?.total_credits ?? null,
        courses: cgpa?.courses || [],
        cgpa_meta: cgpa ? {
            last_synced_at: cgpa.last_synced_at,
            source: cgpa.source
        } : null,
        attendance: attendance?.attendance || null,
        attendance_summary: attendance?.summary || null,
        attendance_meta: attendance ? {
            academic_year: attendance.academic_year,
            semester: attendance.semester,
            last_synced_at: attendance.last_synced_at
        } : null,
        last_synced_at: timetable?.last_synced_at || cgpa?.last_synced_at || attendance?.last_synced_at || conn?.last_synced_at || null
    };
}

/**
 * Automated Database Backup
 */
export function backupDatabase() {
    try {
        if (!fs.existsSync(DB_PATH)) return null;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(BACKUP_DIR, `kl_attendance_backup_${timestamp}.db`);
        fs.copyFileSync(DB_PATH, backupFile);
        console.log(`[Database] Backup successfully created at: ${backupFile}`);

        // Prune old backups, keeping only last 7
        const files = fs.readdirSync(BACKUP_DIR).filter(f => f.startsWith('kl_attendance_backup_')).sort();
        while (files.length > 7) {
            const old = files.shift();
            try {
                fs.unlinkSync(path.join(BACKUP_DIR, old));
            } catch { /* ignore */ }
        }
        return backupFile;
    } catch (e) {
        console.warn('[Database] Backup notice:', e.message);
        return null;
    }
}
