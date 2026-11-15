import "dotenv/config";
import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";
import { hashPassword, verifyPassword, signToken, verifyToken, requireAuth } from "./auth.js";
import { createUser, findUser, findUserByGoogleId, findUserByEmail } from "./userStore.js";
import {
  createTournament,
  getTournament,
  listTournamentsForUser,
  allTournaments,
  persistTournament,
  loadActiveTournamentsFromDB,
} from "./tournamentStore.js";
import { createTemplate, listTemplatesByOwner, getTemplate, updateTemplate, deleteTemplate } from "./templateStore.js";
import { isGoogleAuthConfigured, getGoogleAuthUrl, getGoogleProfile } from "./googleAuth.js";
import { normalizeLevels } from "./levels.js";
import { connectDB } from "./db.js";

const PORT = process.env.PORT || 4000;

// CLIENT_ORIGIN accepts a comma-separated list so the same server can serve
// the frontend from several origins at once (localhost + the LAN IP, or a
// Vercel domain). Trailing slashes are stripped because a browser's Origin
// header never includes one — a pasted-with-trailing-slash value would
// otherwise silently fail every CORS check (REST and Socket.IO alike).
const CLIENT_ORIGINS = (process.env.CLIENT_ORIGIN || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
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

app.post("/api/templates", requireAuth, async (req, res) => {
  const { name, levels, startingStack } = req.body || {};
  if (!name || !Array.isArray(levels) || levels.length === 0 || !startingStack) {
    return res.status(400).json({ error: "name, levels, and startingStack are required" });
  }

  let normalizedLevels;
  try {
    normalizedLevels = normalizeLevels(levels);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const template = await createTemplate(req.username, { name, levels: normalizedLevels, startingStack });
  res.status(201).json({
    templateId: template._id,
    name: template.name,
    levels: template.levels,
    startingStack: template.startingStack,
    createdAt: template.createdAt,
  });
});

app.get("/api/templates", requireAuth, async (req, res) => {
  const templates = await listTemplatesByOwner(req.username);
  res.json({
    templates: templates.map((t) => ({
      templateId: t._id,
      name: t.name,
      levels: t.levels,
      startingStack: t.startingStack,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    })),
  });
});

app.put("/api/templates/:id", requireAuth, async (req, res) => {
  const { name, levels, startingStack } = req.body || {};
  const updates = {};
  if (name !== undefined) updates.name = name;
  if (startingStack !== undefined) updates.startingStack = startingStack;
  if (levels !== undefined) {
    try {
      updates.levels = normalizeLevels(levels);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const template = await updateTemplate(req.params.id, req.username, updates);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json({
    templateId: template._id,
    name: template.name,
    levels: template.levels,
    startingStack: template.startingStack,
  });
});

app.delete("/api/templates/:id", requireAuth, async (req, res) => {
  const template = await deleteTemplate(req.params.id, req.username);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.status(204).end();
});

app.post("/api/tournaments", requireAuth, async (req, res) => {
  const { templateId } = req.body || {};
  let seed = {};
  if (templateId) {
    const template = await getTemplate(templateId, req.username);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    seed = { levels: template.levels, startingStack: template.startingStack, templateId: template._id };
  }

  const tournament = await createTournament(req.username, seed);
  res.status(201).json({ tournamentId: tournament.id });
});

app.get("/api/tournaments", requireAuth, (req, res) => {
  const tournaments = listTournamentsForUser(req.username).map((t) => ({
    tournamentId: t.id,
    createdAt: t.createdAt,
    status: t.clock.getState().status,
    playerCount: t.players.length,
    isOwner: t.ownerUsername === req.username,
  }));
  res.json({ tournaments });
});

app.post("/api/tournaments/:id/end", requireAuth, async (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament || !tournament.isManagedBy(req.username)) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  if (tournament.status === "ended") {
    return res.status(409).json({ error: "Tournament already ended" });
  }

  tournament.end();
  broadcastTournament(tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] end failed for tournament ${tournament.id}:`, err);
  }
  res.json({ ok: true });
});

// Admin management is strictly owner-only — admins can run gameplay actions
// (enforced via isManagedBy below) but can't grant/revoke access themselves.
app.get("/api/tournaments/:id/admins", requireAuth, (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament || tournament.ownerUsername !== req.username) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  res.json({
    ownerUsername: tournament.ownerUsername,
    admins: tournament.admins.map((username) => ({
      username,
      email: findUser(username)?.email || username,
    })),
  });
});

app.post("/api/tournaments/:id/admins", requireAuth, async (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament || tournament.ownerUsername !== req.username) {
    return res.status(404).json({ error: "Tournament not found" });
  }

  const { email } = req.body || {};
  const user = findUserByEmail(email || "");
  if (!user) {
    return res.status(404).json({ error: "No registered user found with that email" });
  }

  try {
    tournament.addAdmin(user.username);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  broadcastTournament(tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] addAdmin failed for tournament ${tournament.id}:`, err);
  }
  res.json({ ok: true });
});

app.delete("/api/tournaments/:id/admins/:username", requireAuth, async (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament || tournament.ownerUsername !== req.username) {
    return res.status(404).json({ error: "Tournament not found" });
  }

  tournament.removeAdmin(req.params.username);
  broadcastTournament(tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] removeAdmin failed for tournament ${tournament.id}:`, err);
  }
  res.json({ ok: true });
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
  if (!socket.data.username || !tournament.isManagedBy(socket.data.username)) {
    throw new Error("Unauthorized");
  }
  if (tournament.status === "ended") {
    throw new Error("Tournament has ended");
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
        // Fire-and-forget: a Mongo hiccup must never stall the live clock or
        // the ack the client already received (see tournamentStore.js).
        persistTournament(tournament).catch((err) =>
          console.error(`[persist] ${event} failed for tournament ${tournamentId}:`, err),
        );
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
// Only persists to Mongo when a level actually advanced, not every second.
setInterval(() => {
  for (const tournament of allTournaments()) {
    const { broadcast, persist } = tournament.clock.tick();
    if (broadcast) broadcastTournament(tournament);
    if (persist) {
      persistTournament(tournament).catch((err) =>
        console.error(`[persist] tick advance failed for tournament ${tournament.id}:`, err),
      );
    }
  }
}, 1000);

async function start() {
  try {
    await connectDB();
    await loadActiveTournamentsFromDB();
  } catch (err) {
    console.error("[startup] Failed to initialize MongoDB:", err);
    process.exit(1);
  }

  httpServer.listen(PORT, () => {
    console.log(`Poker clock server listening on port ${PORT}`);
  });
}

start();
