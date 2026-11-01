import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { hashPassword, verifyPassword, signToken, verifyToken, requireAuth } from "./auth.js";
import { createUser, findUser, findUserByGoogleId } from "./userStore.js";
import { createTournament, getTournament, listTournamentsByOwner, allTournaments } from "./tournamentStore.js";
import { isGoogleAuthConfigured, getGoogleAuthUrl, getGoogleProfile } from "./googleAuth.js";

const PORT = process.env.PORT || 4000;

// CLIENT_ORIGIN accepts a comma-separated list so the same server can serve
// the frontend from several origins at once (localhost + the LAN IP).
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const CLIENT_ORIGIN = CLIENT_ORIGINS[0];

const app = express();
app.use(cors({ origin: CLIENT_ORIGINS }));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.post("/api/auth/signup", async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }
  if (findUser(username)) {
    return res.status(409).json({ error: "Username already taken" });
  }
  const passwordHash = await hashPassword(password);
  createUser({ username, passwordHash });
  res.status(201).json({ token: signToken(username), username });
});

app.post("/api/auth/login", async (req, res) => {
  const { username, password } = req.body || {};
  const user = findUser(username || "");
  if (!user || !user.passwordHash || !(await verifyPassword(password || "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  res.json({ token: signToken(username), username });
});

app.get("/auth/google", (_req, res) => {
  if (!isGoogleAuthConfigured) {
    return res.status(503).json({ error: "Google sign-in is not configured" });
  }
  res.redirect(getGoogleAuthUrl());
});

app.get("/auth/google/callback", async (req, res) => {
  const { code, error } = req.query;
  if (!isGoogleAuthConfigured || error || !code) {
    return res.redirect(`${CLIENT_ORIGIN}/manager/login?error=google_auth_failed`);
  }

  try {
    const { googleId, email, displayName } = await getGoogleProfile(code);

    let user = findUserByGoogleId(googleId);
    if (!user) {
      // Link to an existing local account with the same email, otherwise create one.
      user = findUser(email);
      if (user) {
        user.googleId = googleId;
        user.displayName = user.displayName || displayName;
      } else {
        user = createUser({ username: email, googleId, email, displayName });
      }
    }

    const token = signToken(user.username);
    const params = new URLSearchParams({ token, username: user.username });
    res.redirect(`${CLIENT_ORIGIN}/manager/oauth-callback?${params.toString()}`);
  } catch {
    res.redirect(`${CLIENT_ORIGIN}/manager/login?error=google_auth_failed`);
  }
});

app.post("/api/tournaments", requireAuth, (req, res) => {
  const tournament = createTournament(req.username);
  res.status(201).json({ tournamentId: tournament.id });
});

app.get("/api/tournaments", requireAuth, (req, res) => {
  const tournaments = listTournamentsByOwner(req.username).map((t) => ({
    tournamentId: t.id,
    createdAt: t.createdAt,
    status: t.clock.getState().status,
    playerCount: t.players.length,
  }));
  res.json({ tournaments });
});

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS },
});

// Identifies the connecting socket if it carries a manager token. Player
// sockets never send one, so they stay anonymous and can only join rooms.
io.use((socket, next) => {
  const { token } = socket.handshake.auth || {};
  if (token) {
    try {
      socket.data.username = verifyToken(token).username;
    } catch {
      // Invalid/expired token: fall through as unauthenticated rather than
      // rejecting the connection outright.
    }
  }
  next();
});

const roomName = (tournamentId) => `tournament:${tournamentId}`;

function broadcastTournament(tournament) {
  io.to(roomName(tournament.id)).emit("tournament:state", tournament.getState());
}

function requireOwnedTournament(socket, tournamentId) {
  const tournament = getTournament(tournamentId);
  if (!tournament) {
    throw new Error("Tournament not found");
  }
  if (!socket.data.username || socket.data.username !== tournament.ownerUsername) {
    throw new Error("Unauthorized");
  }
  return tournament;
}

io.on("connection", (socket) => {
  socket.on("tournament:join", ({ tournamentId } = {}, ack) => {
    const tournament = getTournament(tournamentId);
    if (!tournament) {
      ack?.({ ok: false, error: "Tournament not found" });
      return;
    }
    socket.join(roomName(tournamentId));
    ack?.({ ok: true, state: tournament.getState() });
  });

  function onManagerAction(event, mutate) {
    socket.on(event, ({ tournamentId, ...payload } = {}, ack) => {
      try {
        const tournament = requireOwnedTournament(socket, tournamentId);
        mutate(tournament, payload);
        broadcastTournament(tournament);
        ack?.({ ok: true });
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });
  }

  onManagerAction("manager:start", (t) => t.clock.start());
  onManagerAction("manager:pause", (t) => t.clock.pause());
  onManagerAction("manager:reset", (t) => t.clock.reset());
  onManagerAction("manager:skipLevel", (t) => t.clock.skipLevel());
  onManagerAction("manager:previousLevel", (t) => t.clock.previousLevel());
  onManagerAction("manager:updateStructure", (t, { levels }) => t.updateStructure(levels));
  onManagerAction("manager:addPlayer", (t, { name }) => t.addPlayer(name));
  onManagerAction("manager:removePlayer", (t, { playerId }) => t.removePlayer(playerId));
  onManagerAction("manager:eliminatePlayer", (t, { playerId }) => t.eliminatePlayer(playerId));
  onManagerAction("manager:reinstatePlayer", (t, { playerId }) => t.reinstatePlayer(playerId));
  onManagerAction("manager:recordBuyIn", (t, { playerId }) => t.recordBuyIn(playerId));
  onManagerAction("manager:undoBuyIn", (t, { playerId }) => t.undoBuyIn(playerId));
  onManagerAction("manager:recordRebuy", (t, { playerId }) => t.recordRebuy(playerId));
  onManagerAction("manager:undoRebuy", (t, { playerId }) => t.undoRebuy(playerId));
  onManagerAction("manager:recordAddOn", (t, { playerId }) => t.recordAddOn(playerId));
  onManagerAction("manager:undoAddOn", (t, { playerId }) => t.undoAddOn(playerId));
  onManagerAction("manager:setStartingStack", (t, { amount }) => t.setStartingStack(amount));
});

// Server-authoritative tick: advances expired levels and keeps every
// connected client's countdown in sync, regardless of local clock drift.
setInterval(() => {
  for (const tournament of allTournaments()) {
    if (tournament.clock.tick()) {
      broadcastTournament(tournament);
    }
  }
}, 1000);

httpServer.listen(PORT, () => {
  console.log(`Poker clock server listening on port ${PORT}`);
});
