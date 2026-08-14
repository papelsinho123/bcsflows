export const findUserByCredentials = (users = [], username = '', password = '') => {
  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPassword = String(password || '').trim();

  return users.find((account) => {
    const candidateUsername = String(account.username || account.userName || account.email || '').trim().toLowerCase();
    return candidateUsername === normalizedUsername && String(account.password || '').trim() === normalizedPassword;
  });
};
