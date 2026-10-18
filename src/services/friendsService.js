// Service to manage saved friends and user credentials locally
// Defensively stored in localStorage so credentials are never transmitted externally

// Regex to permanently strip any unicode emojis from strings
export const stripEmojis = (str = '') => {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/gu, '')
        .trim();
};

export const FRIEND_NICKNAMES = [
    { id: 'buddy', name: 'Buddy' },
    { id: 'bubu', name: 'Bubu' },
    { id: 'pookie', name: 'Pookie' },
    { id: 'bubs', name: 'Bubs' },
    { id: 'mochi', name: 'Mochi' },
    { id: 'coco', name: 'Coco' },
    { id: 'moonie', name: 'Moonie' },
    { id: 'teddy', name: 'Teddy' },
    { id: 'momo', name: 'Momo' },
    { id: 'boobear', name: 'Boo Bear' }
];

const FRIENDS_STORAGE_KEY = 'kl_saved_friends';
const ACTIVE_PROFILE_KEY = 'kl_active_profile_id';

// Obfuscate password for safe local storage
export const encodePassword = (pass) => {
    try {
        return btoa(unescape(encodeURIComponent(pass)));
    } catch {
        return btoa(pass);
    }
};

export const decodePassword = (encoded) => {
    if (!encoded) return '';
    try {
        return decodeURIComponent(escape(atob(encoded)));
    } catch {
        try {
            return atob(encoded);
        } catch {
            return encoded;
        }
    }
};

/**
 * Retrieve all saved friends (with emojis stripped out permanently)
 */
export const getSavedFriends = () => {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(FRIENDS_STORAGE_KEY);
        let list = [];
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    list = parsed.map(f => ({
                        ...f,
                        nickname: stripEmojis(f.nickname || f.name) || 'Buddy',
                        label: stripEmojis(f.nickname || f.name) || 'Buddy',
                        emoji: ''
                    }));
                }
            } catch { /* ignore */ }
        }

        // Also merge friends from TimeTablekl 'maddys'
        try {
            const rawMaddys = localStorage.getItem('maddys');
            if (rawMaddys) {
                const parsedMaddys = JSON.parse(rawMaddys);
                if (Array.isArray(parsedMaddys)) {
                    parsedMaddys.forEach(m => {
                        const sid = m.username || m.studentId || String(m.id || '');
                        if (sid && !list.some(f => (f.studentId === sid || f.username === sid || f.id === sid))) {
                            list.push({
                                id: m.id ? String(m.id) : `maddy_${sid}`,
                                nickname: stripEmojis(m.name || m.nickname) || 'Buddy',
                                label: stripEmojis(m.name || m.nickname) || 'Buddy',
                                studentId: sid,
                                username: sid,
                                password: m.password ? encodePassword(m.password) : '',
                                hasSavedPassword: Boolean(m.password),
                                emoji: ''
                            });
                        }
                    });
                }
            }
        } catch { /* ignore */ }

        return list;
    } catch (err) {
        console.warn('[FriendsService] Failed to read saved friends:', err);
        return [];
    }
};

/**
 * Retrieve user's own profile (emoji-free)
 */
export const getMyProfile = () => {
    if (typeof window === 'undefined') return null;
    try {
        const myId = localStorage.getItem('rememberedId') || localStorage.getItem('activeErpUser') || '';
        const rawName = localStorage.getItem('rememberedName') || 'My Account';
        const cleanName = stripEmojis(rawName) || 'My Account';
        const myPass = localStorage.getItem('rememberedPassword') || '';

        return {
            id: 'main',
            isFriend: false,
            nickname: cleanName,
            label: cleanName,
            studentId: myId,
            password: myPass,
            hasSavedPassword: Boolean(myPass)
        };
    } catch {
        return {
            id: 'main',
            isFriend: false,
            nickname: 'My Account',
            label: 'My Account',
            studentId: '',
            password: '',
            hasSavedPassword: false
        };
    }
};

/**
 * Save user's own profile credentials & name (emoji-free)
 */
export const saveMyProfile = ({ nickname, studentId, password }) => {
    if (typeof window === 'undefined') return null;
    const cleanId = (studentId || '').trim();
    const cleanNick = stripEmojis(nickname) || 'My Account';

    try {
        if (cleanId) localStorage.setItem('rememberedId', cleanId);
        if (password) localStorage.setItem('rememberedPassword', encodePassword(password));
        localStorage.setItem('rememberedName', cleanNick);
        localStorage.removeItem('rememberedEmoji');

        window.dispatchEvent(new CustomEvent('kl_friends_updated'));
        window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: 'main' }));
        return getMyProfile();
    } catch (err) {
        console.warn('[FriendsService] Failed to save my profile:', err);
        return null;
    }
};

/**
 * Save a new friend or update an existing one (emoji-free)
 */
export const saveFriend = ({ id, nickname, studentId, password }) => {
    if (typeof window === 'undefined') return null;
    const cleanId = (studentId || '').trim();
    const cleanNick = stripEmojis(nickname) || 'Buddy';
    if (!cleanId || !cleanNick) {
        throw new Error('Please enter a name and student ID.');
    }

    try {
        const friends = getSavedFriends();
        // Check by ID if editing, otherwise check by studentId
        let existingIdx = -1;
        if (id) {
            existingIdx = friends.findIndex(f => f.id === id);
        }
        if (existingIdx === -1) {
            existingIdx = friends.findIndex(f => f.studentId.toLowerCase() === cleanId.toLowerCase());
        }

        const prevPassword = existingIdx >= 0 ? friends[existingIdx].password : '';
        const finalEncodedPassword = password ? encodePassword(password) : prevPassword;

        if (!finalEncodedPassword) {
            throw new Error('Please enter the ERP password to save.');
        }

        const friendEntry = {
            id: existingIdx >= 0 ? friends[existingIdx].id : (id || `friend_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`),
            nickname: cleanNick,
            label: cleanNick,
            studentId: cleanId,
            password: finalEncodedPassword,
            savedAt: Date.now()
        };

        if (existingIdx >= 0) {
            friends[existingIdx] = friendEntry;
        } else {
            friends.push(friendEntry);
        }

        localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));

        // Sync to TimeTablekl 'maddys' format as well
        try {
            const rawM = localStorage.getItem('maddys');
            let mList = rawM ? JSON.parse(rawM) : [];
            if (!Array.isArray(mList)) mList = [];
            const mIdx = mList.findIndex(m => (m.username || m.studentId) === cleanId);
            const mEntry = {
                id: friendEntry.id,
                name: cleanNick,
                username: cleanId,
                studentId: cleanId,
                password: password || (mIdx >= 0 ? mList[mIdx].password : '')
            };
            if (mIdx >= 0) mList[mIdx] = { ...mList[mIdx], ...mEntry };
            else mList.push(mEntry);
            localStorage.setItem('maddys', JSON.stringify(mList));
        } catch { /* ignore */ }

        window.dispatchEvent(new CustomEvent('kl_friends_updated', { detail: friends }));
        window.dispatchEvent(new Event('storage'));
        return friendEntry;
    } catch (err) {
        console.error('[FriendsService] Failed to save friend:', err);
        throw new Error(err.message || 'Could not save friend details to local storage.');
    }
};

/**
 * Delete a friend profile
 */
export const deleteFriend = (friendId) => {
    if (typeof window === 'undefined') return;
    try {
        const friends = getSavedFriends();
        const toDelete = friends.find(f => f.id === friendId || f.studentId === friendId || f.username === friendId);
        const filtered = friends.filter(f => f.id !== friendId && (toDelete ? f.studentId !== toDelete.studentId : true));
        localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(filtered));

        // Also remove from maddys
        try {
            const rawM = localStorage.getItem('maddys');
            if (rawM) {
                let mList = JSON.parse(rawM);
                if (Array.isArray(mList)) {
                    mList = mList.filter(m => m.id !== friendId && (toDelete ? (m.username !== toDelete.studentId && m.studentId !== toDelete.studentId) : true));
                    localStorage.setItem('maddys', JSON.stringify(mList));
                }
            }
        } catch { /* ignore */ }

        // If the active profile was deleted, reset to main
        const activeId = getActiveProfileId();
        if (activeId === friendId || (toDelete && activeId === toDelete.id)) {
            setActiveProfileId('main');
        }

        window.dispatchEvent(new CustomEvent('kl_friends_updated', { detail: filtered }));
        window.dispatchEvent(new Event('storage'));
    } catch (err) {
        console.warn('[FriendsService] Failed to delete friend:', err);
    }
};

/**
 * Save or import a friend's timetable without requiring their password (privacy-preserving)
 */
export const saveFriendTimetable = ({ studentId, nickname, timetable, academicYear = '2026-2027', semester = 'Odd Sem' }) => {
    if (typeof window === 'undefined') return null;
    const cleanId = (studentId || '').trim();
    const cleanNick = stripEmojis(nickname) || cleanId || 'Buddy';
    if (!cleanId) {
        throw new Error('Please provide a valid Student ID');
    }

    try {
        const friends = getSavedFriends();
        let existingIdx = friends.findIndex(f => f.studentId.toLowerCase() === cleanId.toLowerCase());
        const friendEntry = {
            id: existingIdx >= 0 ? friends[existingIdx].id : `friend_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            nickname: cleanNick,
            label: cleanNick,
            studentId: cleanId,
            password: existingIdx >= 0 ? friends[existingIdx].password : '',
            hasSavedPassword: existingIdx >= 0 ? Boolean(friends[existingIdx].password) : false,
            savedAt: Date.now()
        };

        if (existingIdx >= 0) {
            friends[existingIdx] = { ...friends[existingIdx], ...friendEntry };
        } else {
            friends.push(friendEntry);
        }

        localStorage.setItem(FRIENDS_STORAGE_KEY, JSON.stringify(friends));

        // Save timetable to storage
        if (timetable) {
            const sLow = String(semester || '').trim().toLowerCase();
            const semClean = sLow.includes('summer') || sLow === '3' ? 'Summer Term'
                : sLow.includes('even') || sLow === '2' ? 'Even Sem'
                : ((sLow.includes('term') && !sLow.includes('summer')) || sLow.includes('tri') || sLow === '4') ? 'Tri Sem / Term 3'
                : 'Odd Sem';
            localStorage.setItem(`kl_timetable_${cleanId}_${academicYear}_${semClean}`, JSON.stringify(timetable));
            localStorage.setItem(`kl_timetable_${cleanId}`, JSON.stringify(timetable));
        }

        // Also sync into maddys
        try {
            const rawM = localStorage.getItem('maddys');
            let mList = rawM ? JSON.parse(rawM) : [];
            if (!Array.isArray(mList)) mList = [];
            const mIdx = mList.findIndex(m => (m.username || m.studentId) === cleanId);
            const mEntry = {
                id: friendEntry.id,
                name: cleanNick,
                username: cleanId,
                studentId: cleanId,
                academicYear,
                semester,
                timetable: timetable || (mIdx >= 0 ? mList[mIdx].timetable : null)
            };
            if (mIdx >= 0) mList[mIdx] = { ...mList[mIdx], ...mEntry };
            else mList.push(mEntry);
            localStorage.setItem('maddys', JSON.stringify(mList));
        } catch { /* ignore */ }

        window.dispatchEvent(new CustomEvent('kl_friends_updated', { detail: friends }));
        window.dispatchEvent(new CustomEvent('kl_timetable_updated', { detail: { studentId: cleanId } }));
        return friendEntry;
    } catch (err) {
        console.error('[FriendsService] Failed to save friend timetable:', err);
        throw err;
    }
};

/**
 * Get active profile ID ('main' or friend.id)
 */
export const getActiveProfileId = () => {
    if (typeof window === 'undefined') return 'main';
    try {
        return localStorage.getItem(ACTIVE_PROFILE_KEY) || 'main';
    } catch {
        return 'main';
    }
};

/**
 * Set active profile ID
 */
export const setActiveProfileId = (profileId) => {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(ACTIVE_PROFILE_KEY, profileId || 'main');
        window.dispatchEvent(new CustomEvent('kl_active_profile_updated', { detail: profileId }));
    } catch (err) {
        console.warn('[FriendsService] Failed to set active profile:', err);
    }
};

/**
 * Get active profile details (main user or friend object)
 */
export const getActiveProfileDetails = () => {
    const profileId = getActiveProfileId();
    if (profileId === 'main') {
        return getMyProfile();
    }

    const friends = getSavedFriends();
    const friend = friends.find(f => f.id === profileId);
    if (friend) {
        return {
            ...friend,
            isFriend: true
        };
    }

    return getMyProfile();
};

/**
 * Get all profiles (My Account + all saved friends)
 */
export const getAllProfiles = () => {
    const myProfile = getMyProfile();
    const friends = getSavedFriends();
    const list = [];
    if (myProfile && (myProfile.studentId || myProfile.password)) {
        list.push(myProfile);
    }
    return [...list, ...friends];
};
