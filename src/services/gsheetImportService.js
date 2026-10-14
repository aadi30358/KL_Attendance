import { doc, writeBatch, increment, setDoc } from 'firebase/firestore';
import { db } from '../firebase.js';
import { GOOGLE_SHEET_URL } from './gsheetsService.js';

/**
 * Robust date/time parser to create standard ISO timestamps
 * Handles DD/MM/YYYY, YYYY-MM-DD, 12h/24h time strings, and ISO timestamps
 */
export function normalizeDateTime(dateStr, timeStr, timestampStr) {
    // Strictly validate timestampStr: only accept if it is a genuine ISO or date formatted string, NEVER passwords or arbitrary text
    if (timestampStr && typeof timestampStr === 'string') {
        const cleanTs = timestampStr.trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(cleanTs)) {
            const d = new Date(cleanTs);
            if (!isNaN(d.getTime())) {
                return d;
            }
        }
    }

    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth();
    let day = now.getDate();

    if (dateStr && typeof dateStr === 'string') {
        const cleanDate = dateStr.trim();
        // Check for ISO-like YYYY-MM-DD
        const isoMatch = cleanDate.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
        // Check for DD/MM/YYYY or D/M/YYYY
        const dmyMatch = cleanDate.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})/);

        if (isoMatch) {
            year = parseInt(isoMatch[1], 10);
            month = parseInt(isoMatch[2], 10) - 1;
            day = parseInt(isoMatch[3], 10);
        } else if (dmyMatch) {
            day = parseInt(dmyMatch[1], 10);
            month = parseInt(dmyMatch[2], 10) - 1;
            let rawYear = parseInt(dmyMatch[3], 10);
            if (rawYear < 100) rawYear += 2000;
            year = rawYear;
        } else {
            const parsedDate = new Date(cleanDate);
            if (!isNaN(parsedDate.getTime())) {
                year = parsedDate.getFullYear();
                month = parsedDate.getMonth();
                day = parsedDate.getDate();
            }
        }
    }

    // Sanitize year: Valid academic year for this portal is between 2024 and 2030.
    // If year is corrupted (e.g. 9989 or 1806 or 2005 from legacy misordered sheet columns), default to current year.
    if (year < 2024 || year > 2030) {
        year = now.getFullYear();
    }

    let hours = 12;
    let minutes = 0;
    let seconds = 0;

    if (timeStr && typeof timeStr === 'string') {
        const cleanTime = timeStr.trim();
        const isPM = /pm/i.test(cleanTime);
        const isAM = /am/i.test(cleanTime);
        const numPart = cleanTime.replace(/[^\d:]/g, '');
        const timeParts = numPart.split(':');

        if (timeParts.length >= 2) {
            hours = parseInt(timeParts[0], 10);
            minutes = parseInt(timeParts[1], 10);
            seconds = timeParts[2] ? parseInt(timeParts[2], 10) : 0;

            if (isPM && hours < 12) hours += 12;
            if (isAM && hours === 12) hours = 0;
        }
    }

    // Construct valid Date in Indian Standard Time (IST, +05:30)
    const pad = (n) => String(n).padStart(2, '0');
    const istIso = `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:${pad(seconds)}+05:30`;
    const resultDate = new Date(istIso);
    if (!isNaN(resultDate.getTime())) {
        return resultDate;
    }

    const fallback = new Date();
    fallback.setFullYear(year, Math.max(0, Math.min(11, month)), Math.max(1, Math.min(31, day)));
    fallback.setHours(hours, minutes, seconds, 0);
    return fallback;
}

/**
 * Parses raw text from Google Sheets (TSV or CSV or JSON)
 * CRITICAL RULE: ONLY extracts student ID, Date, and Time (and device info).
 * Passwords and other sensitive columns are strictly excluded.
 */
export function parseGoogleSheetData(rawInput) {
    if (!rawInput || typeof rawInput !== 'string') return [];

    const text = rawInput.trim();
    if (!text) return [];

    // 1. Try parsing as JSON array if input starts with '['
    if (text.startsWith('[') && text.endsWith(']')) {
        try {
            const jsonData = JSON.parse(text);
            if (Array.isArray(jsonData)) {
                return jsonData.map((item, idx) => {
                    let sId = String(item.studentId || item.id || item.roll || item.username || '').trim().toUpperCase();
                    if (sId.startsWith('GSHEET_') && item.studentId) {
                        sId = String(item.studentId).trim().toUpperCase();
                    }
                    if (!sId || !/^\d{8,12}$/.test(sId)) return null;

                    const date = String(item.date || item.Date || '').trim();
                    const time = String(item.time || item.Time || '').trim();
                    const timestamp = String(item.timestamp || item.Timestamp || '').trim();
                    const device = String(item.device || item.Device || 'Google Sheets').trim();

                    const parsedDate = normalizeDateTime(date, time, timestamp);
                    const validIso = (timestamp && typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(timestamp.trim()) && !isNaN(new Date(timestamp.trim()).getTime()))
                        ? new Date(timestamp.trim()).toISOString()
                        : (parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toISOString() : '');
                    const yyyymmdd = (parsedDate && !isNaN(parsedDate.getTime()))
                        ? parsedDate.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
                        : (validIso ? validIso.slice(0, 10) : '');
                    const recordId = `gsheet_${parsedDate.getTime() || Date.now()}_${sId}_${idx}`;

                    return {
                        id: recordId,
                        studentId: sId,
                        date: yyyymmdd,
                        month: yyyymmdd.slice(0, 7),
                        year: yyyymmdd.slice(0, 4),
                        time: time || (parsedDate && !isNaN(parsedDate.getTime()) ? parsedDate.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }) : ''),
                        timestamp: validIso,
                        device: device || 'Google Sheets',
                        source: 'Google Sheet',
                        userAgent: 'Google Sheets Integration'
                    };
                }).filter(Boolean);
            }
        } catch {
            // Not JSON, continue to CSV/TSV parser
        }
    }

    // 2. Line-by-line parsing for TSV / CSV
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length === 0) return [];

    // Determine delimiter: tab vs comma
    const firstLine = lines[0];
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const delimiter = tabCount >= commaCount ? '\t' : ',';

    const parseLine = (line) => {
        if (delimiter === '\t') {
            return line.split('\t').map(c => c.trim().replace(/^["']|["']$/g, ''));
        }
        // CSV with regex to support quoted commas
        const regex = /(?:,|\n|^)("(?:(?:"")*[^"]*)*"|[^",\n]*|(?:\n|$))/g;
        const matches = [];
        let match;
        while ((match = regex.exec(line)) !== null) {
            let val = match[1] || '';
            if (val.startsWith('"') && val.endsWith('"')) {
                val = val.slice(1, -1).replace(/""/g, '"');
            }
            matches.push(val.trim());
            if (regex.lastIndex >= line.length) break;
        }
        return matches.length > 0 ? matches : line.split(',').map(c => c.trim());
    };

    const headerParts = parseLine(firstLine).map(h => h.toLowerCase().trim());
    const hasHeader = headerParts.some(h => 
        h.includes('id') || h.includes('student') || h.includes('date') || h.includes('time') || h.includes('roll')
    );

    let idIdx = -1;
    let dateIdx = -1;
    let timeIdx = -1;
    let tsIdx = -1;
    let devIdx = -1;
    let startLine = 0;

    if (hasHeader) {
        startLine = 1;
        headerParts.forEach((h, idx) => {
            if (h === 'id' || h.includes('student') || h.includes('roll') || h.includes('user')) {
                if (idIdx === -1) idIdx = idx;
            } else if (h.includes('time') && !h.includes('stamp')) {
                if (timeIdx === -1) timeIdx = idx;
            } else if (h.includes('timestamp') || h.includes('datetime')) {
                if (tsIdx === -1) tsIdx = idx;
            } else if (h.includes('date')) {
                if (dateIdx === -1) dateIdx = idx;
            } else if (h.includes('device') || h.includes('platform')) {
                if (devIdx === -1) devIdx = idx;
            }
            // Passwords explicitly ignored and never assigned
        });
    }

    const parsedRecords = [];

    for (let i = startLine; i < lines.length; i++) {
        const parts = parseLine(lines[i]);
        if (parts.length === 0 || (parts.length === 1 && !parts[0])) continue;

        let id = idIdx >= 0 ? parts[idIdx] : '';
        let date = dateIdx >= 0 ? parts[dateIdx] : '';
        let time = timeIdx >= 0 ? parts[timeIdx] : '';
        let timestamp = tsIdx >= 0 ? parts[tsIdx] : '';
        let device = devIdx >= 0 ? parts[devIdx] : 'Google Sheets';

        // Intelligent column detection fallback:
        // Even if headers exist, if date or id was not mapped or is missing, scan cell values directly
        if (!id || (!date && !timestamp)) {
            parts.forEach((p) => {
                const clean = String(p || '').trim();
                if (!clean) return;

                // Detect date or datetime (e.g. 2/21/2026 19:19:08 or 9/19/2026 14:46:16 or 2026-09-19)
                if (!date && !timestamp && /\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}/.test(clean)) {
                    const parsedD = new Date(clean);
                    if (!isNaN(parsedD.getTime())) {
                        timestamp = parsedD.toISOString();
                        date = parsedD.toISOString().slice(0, 10);
                        time = parsedD.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });
                    }
                }
                // Detect Student ID (e.g. 2400030358, 2400032702, 2300080124)
                else if (!id && (/^\d{8,12}$/.test(clean) || /^[0-9]{2}[A-Z0-9]{8}$/i.test(clean))) {
                    id = clean;
                }
                // Detect Device info
                else if ((!devIdx || devIdx === -1) && /mobile|desktop|android|iphone|windows|pc|web|ios|mac/i.test(clean)) {
                    device = clean;
                }
            });
            if (!id && parts[0] && !/\d{1,2}[-/.]/.test(parts[0])) {
                id = parts[0];
            }
        }

        const cleanId = String(id || '').trim().toUpperCase();
        // Strictly require valid student roll number (8 to 12 digits, no headers or test text)
        if (!cleanId || !/^\d{8,12}$/.test(cleanId)) continue;

        const dateObj = normalizeDateTime(date, time, timestamp);
        const recordId = `gsheet_row_${i + 1}_${cleanId}`;

        // Ensure timestamp is ALWAYS a genuine ISO string, NEVER a password string from dirty Google Sheet column
        let validIsoTimestamp = '';
        if (timestamp && typeof timestamp === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(timestamp.trim())) {
            const testD = new Date(timestamp.trim());
            if (!isNaN(testD.getTime())) {
                validIsoTimestamp = testD.toISOString();
            }
        }
        if (!validIsoTimestamp && dateObj && !isNaN(dateObj.getTime())) {
            validIsoTimestamp = dateObj.toISOString();
        }

        const yyyymmdd = (dateObj && !isNaN(dateObj.getTime()))
            ? dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
            : (date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : (validIsoTimestamp ? validIsoTimestamp.slice(0, 10) : ''));

        const timeDisplay = time || (dateObj && !isNaN(dateObj.getTime())
            ? dateObj.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
            : '');

        parsedRecords.push({
            id: recordId,
            studentId: cleanId,
            date: yyyymmdd,
            month: yyyymmdd ? yyyymmdd.slice(0, 7) : '',
            year: yyyymmdd ? yyyymmdd.slice(0, 4) : '',
            time: timeDisplay,
            timestamp: validIsoTimestamp,
            device: device || 'Laptop / PC',
            source: 'Google Sheet',
            userAgent: 'Google Sheets Integration'
        });
    }

    // Return in reverse chronological order (newest first)
    parsedRecords.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return parsedRecords;
}

export const DEFAULT_GOOGLE_SHEET_URL = GOOGLE_SHEET_URL || "https://docs.google.com/spreadsheets/d/1kRokaA31REd4MR2f1N9Q4mH8Lh0IBVwSYB0yiMzrpt0/edit?usp=sharing";
export const DEFAULT_GOOGLE_SHEET_URLS = [
    DEFAULT_GOOGLE_SHEET_URL
];

/**
 * Fetches Google Sheet data from all configured sheets in parallel,
 * parses valid rows, excludes passwords, and merges records with zero duplicates.
 */
export async function fetchAllGoogleSheetsCSV(urls = DEFAULT_GOOGLE_SHEET_URLS) {
    const list = Array.isArray(urls) ? urls : [urls];
    const results = await Promise.allSettled(list.map(u => fetchGoogleSheetCSV(u)));

    const merged = [];
    const seenExactKeys = new Set();
    const statuses = [];

    results.forEach((res, idx) => {
        const sheetUrl = list[idx];
        if (res.status === 'fulfilled' && Array.isArray(res.value)) {
            statuses.push({
                url: sheetUrl,
                success: true,
                count: res.value.length
            });
            res.value.forEach(record => {
                const exactKey = `${record.studentId}_${record.timestamp}`;
                if (!seenExactKeys.has(exactKey)) {
                    seenExactKeys.add(exactKey);
                    merged.push(record);
                }
            });
        } else {
            const err = res.reason ? (res.reason.message || String(res.reason)) : 'Failed to fetch sheet';
            statuses.push({
                url: sheetUrl,
                success: false,
                error: err
            });
            console.warn(`[GSheet Sync] Sheet #${idx + 1} (${sheetUrl}) notice:`, err);
        }
    });

    merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return { records: merged, statuses };
}

/**
 * Extracts Google Spreadsheet ID from various URL formats
 */
export function extractSpreadsheetId(urlOrId) {
    if (!urlOrId) return '';
    const trimmed = urlOrId.trim();
    // Direct ID check
    if (/^[a-zA-Z0-9-_]{30,60}$/.test(trimmed)) {
        return trimmed;
    }
    // URL pattern: https://docs.google.com/spreadsheets/d/{ID}/...
    const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    if (match && match[1]) {
        return match[1];
    }
    return '';
}

/**
 * Fetches Google Sheet data directly via Google's CSV export
 * Works for any Google Sheet shared with "Anyone with the link can view"
 */
export async function fetchGoogleSheetCSV(urlOrId) {
    if (!urlOrId) return [];
    if (urlOrId.includes('script.google.com')) {
        try {
            const resp = await fetch(urlOrId);
            if (resp.ok) {
                const text = await resp.text();
                if (text && !text.includes('Script function not found') && !text.includes('<!DOCTYPE html>')) {
                    return parseGoogleSheetData(text);
                }
            }
        } catch {
            // ignore script fallback error
        }
        return [];
    }

    const sheetId = extractSpreadsheetId(urlOrId);
    if (!sheetId) {
        throw new Error('Invalid Google Sheet URL or ID. Please check the link and try again.');
    }

    const trimmed = (urlOrId || '').trim();
    const gidMatch = trimmed.match(/[?&#]gid=([0-9]+)/);
    const gidParam = gidMatch ? `&gid=${gidMatch[1]}` : '';

    // Try gviz CSV export first
    const gvizUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv${gidParam}`;
    let isPermissionError = false;

    try {
        const response = await fetch(gvizUrl);
        if (response.status === 401 || response.status === 403) {
            isPermissionError = true;
        } else if (response.ok) {
            const csvText = await response.text();
            if (csvText && csvText.length > 5 && !csvText.includes('<!DOCTYPE html>')) {
                return parseGoogleSheetData(csvText);
            }
        }
    } catch (err) {
        console.warn('gviz fetch attempt failed, trying export?format=csv:', err);
    }

    // Fallback to export?format=csv
    const exportUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gidParam ? `&gid=${gidMatch[1]}` : ''}`;
    try {
        const response = await fetch(exportUrl);
        if (response.status === 401 || response.status === 403) {
            isPermissionError = true;
        } else if (response.ok) {
            const csvText = await response.text();
            if (csvText && csvText.length > 5 && !csvText.includes('<!DOCTYPE html>')) {
                return parseGoogleSheetData(csvText);
            }
        }
    } catch (err) {
        console.warn('export format fetch failed:', err);
    }

    if (isPermissionError) {
        throw new Error('Access Denied (401). In Google Sheets, click "Share" (top right) and set General Access to "Anyone with the link can view", or use Direct Paste.');
    }

    throw new Error('Unable to fetch sheet directly. Please ensure your Google Sheet sharing is set to "Anyone with the link can view", or use the Direct Paste tab.');
}

/**
 * Imports parsed Google Sheet records into Firestore & localStorage
 * Deduplicates against existing login records to avoid double counting.
 */
export async function importGoogleSheetLogins(parsedRecords, existingLogins = []) {
    if (!parsedRecords || parsedRecords.length === 0) {
        return { importedCount: 0, duplicateCount: 0, totalParsed: 0, newLogins: [] };
    }

    // Index existing logins by exact studentId + timestamp
    const existingSet = new Set();
    existingLogins.forEach(item => {
        const sId = (item.studentId || '').toUpperCase();
        if (item.timestamp) {
            existingSet.add(`${sId}_${item.timestamp}`);
        }
    });

    const newLogins = [];
    let duplicateCount = 0;

    parsedRecords.forEach((record, index) => {
        let cleanId = String(record.studentId || record.id || '').trim().toUpperCase();
        if (cleanId.startsWith('GSHEET_')) {
            cleanId = record.studentId ? String(record.studentId).trim().toUpperCase() : (cleanId.split('_')[2] || '');
        }
        if (!cleanId || !/^\d{8,12}$/.test(cleanId)) return;

        const dObj = new Date(record.timestamp);
        const tsMs = !isNaN(dObj.getTime()) ? dObj.getTime() : Date.now();
        const dateKey = !isNaN(dObj.getTime()) ? dObj.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
        const monthKey = dateKey.slice(0, 7);
        const yearKey = dateKey.slice(0, 4);

        // Only prevent exact duplicate timestamp
        const exactKey = `${cleanId}_${record.timestamp}`;

        if (existingSet.has(exactKey)) {
            duplicateCount++;
            return;
        }

        existingSet.add(exactKey);

        const recordId = `gsheet_${tsMs}_${cleanId}_${index}`;
        newLogins.push({
            id: recordId,
            studentId: cleanId,
            timestamp: !isNaN(dObj.getTime()) ? dObj.toISOString() : new Date().toISOString(),
            date: dateKey,
            month: monthKey,
            year: yearKey,
            device: record.device || 'Google Sheets Sync',
            source: 'Google Sheet',
            userAgent: 'Google Sheets Integration'
        });
    });

    if (newLogins.length === 0) {
        return { importedCount: 0, duplicateCount, totalParsed: parsedRecords.length, newLogins: [] };
    }

    // Commit directly to Firestore in chunks of up to 400

    // 2. Batch commit to Firestore in chunks of up to 400
    try {
        const chunkSize = 400;
        for (let i = 0; i < newLogins.length; i += chunkSize) {
            const chunk = newLogins.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach(item => {
                const docRef = doc(db, 'userLogins', item.id);
                batch.set(docRef, item);
            });

            await batch.commit().catch(e => console.warn('Firestore batch write notice:', e));
        }

        // Increment student counts in Firestore
        const countMap = {};
        newLogins.forEach(l => {
            countMap[l.studentId] = (countMap[l.studentId] || 0) + 1;
        });

        for (const [studentId, count] of Object.entries(countMap)) {
            setDoc(doc(db, 'students', studentId), {
                studentId,
                loginCount: increment(count)
            }, { merge: true }).catch(() => {});
        }
    } catch (err) {
        console.warn('Firestore import notice:', err);
    }

    // 3. Dispatch local event for 0ms UI update
    if (typeof window !== 'undefined') {
        newLogins.forEach(l => {
            window.dispatchEvent(new CustomEvent('kl_new_login', { detail: l }));
        });
    }

    return {
        importedCount: newLogins.length,
        duplicateCount,
        totalParsed: parsedRecords.length,
        newLogins
    };
}
