export const normalizeUserRole = (role = '') => String(role || '').trim().toLowerCase();

export const findUserByCredentials = (users = [], username = '', password = '') => {
  const safeUsers = Array.isArray(users)
    ? users
    : Array.isArray(users?.users)
      ? users.users
      : [];

  const normalizedUsername = String(username || '').trim().toLowerCase();
  const normalizedPassword = String(password || '').trim();

  return safeUsers.find((account) => {
    if (!account || typeof account !== 'object') return false;
    const candidateUsername = String(account.usuario || account.username || account.userName || '').trim().toLowerCase();
    const candidatePassword = String(account.password || '').trim();
    const matches = candidateUsername === normalizedUsername && candidatePassword === normalizedPassword;

    if (!matches) return false;

    if (account.role) {
      account.role = normalizeUserRole(account.role);
    }

    return true;
  });
};
