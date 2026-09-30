import { encryptSecret, decryptSecret } from './securityShield';

export const saveCredentials = async (creds) => {
  try {
    const json = JSON.stringify(creds);
    const enc = await encryptSecret(json);
    localStorage.setItem('userCredentials_enc', enc);
    localStorage.removeItem('userCredentials');
  } catch {
    localStorage.setItem('userCredentials', JSON.stringify(creds));
  }
};

export const getCredentials = async () => {
  try {
    const enc = localStorage.getItem('userCredentials_enc');
    if (enc) {
      const dec = await decryptSecret(enc);
      return dec ? JSON.parse(dec) : null;
    }
    const legacy = localStorage.getItem('userCredentials');
    return legacy ? JSON.parse(legacy) : null;
  } catch {
    return null;
  }
};

export const clearCredentials = () => {
  localStorage.removeItem('userCredentials_enc');
  localStorage.removeItem('userCredentials');
};
