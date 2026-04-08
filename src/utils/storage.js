export const saveCredentials = (creds) => {
  localStorage.setItem('userCredentials', JSON.stringify(creds));
};

export const getCredentials = () => {
  const creds = localStorage.getItem('userCredentials');
  return creds ? JSON.parse(creds) : null;
};

export const clearCredentials = () => {
  localStorage.removeItem('userCredentials');
};
