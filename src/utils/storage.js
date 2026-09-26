// Sanitize credentials so passwords are never stored in localStorage
export const saveCredentials = (creds) => {
  if (!creds) return;
  const safeCreds = { ...creds };
  delete safeCreds.password;
  delete safeCreds.pwd;
  localStorage.setItem('userCredentials', JSON.stringify(safeCreds));
};

export const getCredentials = () => {
  const creds = localStorage.getItem('userCredentials');
  if (!creds) return null;
  try {
    const parsed = JSON.parse(creds);
    if (parsed.password || parsed.pwd) {
      delete parsed.password;
      delete parsed.pwd;
      localStorage.setItem('userCredentials', JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearCredentials = () => {
  localStorage.removeItem('userCredentials');
};

