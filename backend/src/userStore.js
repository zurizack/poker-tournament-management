// In-memory user registry. Resets on server restart; no persistence layer yet.
const users = new Map();

export function createUser({ username, passwordHash = null, googleId = null, email = null, displayName = null }) {
  if (users.has(username)) {
    throw new Error("Username already taken");
  }
  const user = { username, passwordHash, googleId, email, displayName };
  users.set(username, user);
  return user;
}

export function findUser(username) {
  return users.get(username);
}

export function findUserByGoogleId(googleId) {
  return Array.from(users.values()).find((user) => user.googleId === googleId);
}
