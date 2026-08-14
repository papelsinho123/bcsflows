export const findUserByCredentials = (users = [], username = '', password = '') => {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPassword = String(password || '').trim();

  return users.find((account) => {
    const candidateUsername = String(account.usuario || account.username || account.userName || '').trim().toLowerCase();
    return candidateUsername === normalizedUsername && String(account.password || '').trim() === normalizedPassword;
  });
};
