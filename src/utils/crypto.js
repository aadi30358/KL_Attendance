export const encryptPassword = (password) => {
    // Basic obscuration since we are fully client-side without a secure backend.
    // We reverse the string and then encode to Base64 twice.
    if (!password) return '';
    const reversed = password.split('').reverse().join('');
    const firstPass = btoa(encodeURIComponent(reversed));
    const secondPass = btoa(firstPass);
    return secondPass;
};

export const decryptPassword = (encrypted) => {
    try {
        const firstPass = atob(encrypted);
        const reversed = decodeURIComponent(atob(firstPass));
        return reversed.split('').reverse().join('');
    } catch {
        return 'decryption-failed';
    }
};
