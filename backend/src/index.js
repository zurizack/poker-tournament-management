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
  listOwnedTournaments,
  listPendingInvitations,
  listManagedTournaments,
  allTournaments,
  persistTournament,
  loadActiveTournamentsFromDB,
} from "./tournamentStore.js";
import {
  createTemplate,
  listTemplatesForUser,
  getTemplate,
  updateTemplate,
  deleteTemplate,
  addTemplateAdmin,
} from "./templateStore.js";
import { createHistory, listHistoryForUser, getHistoryById } from "./historyStore.js";
import {
  createPlayer,
  listPlayersByOwner,
  updatePlayer,
  deletePlayer,
  upsertPlayerSeen,
  recomputePlayerStatsForOwner,
  backfillPlayerStatsFromHistory,
} from "./playerStore.js";
import { isGoogleAuthConfigured, getGoogleAuthUrl, getGoogleProfile } from "./googleAuth.js";
import { normalizeLevels, defaultLevels, cloneLevels } from "./levels.js";
import {
  DEFAULT_PRIZE_CONFIG,
  parsePrizeConfigFields,
  parseEntryFeeFields,
  assertValidPrizeConfig,
} from "./prizePool.js";
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

// Shared by the template and tournament routes below — both accept the same
// rebuy/add-on rule shape (plus the per-entry dollar amounts that feed the
// prize pool calculation), so the validation only lives in one place.
function parseRebuyRules(body) {
  const { allowRebuys, rebuyLimitType, maxRebuysPerPlayer, allowAddOn } = body || {};
  const rules = { ...parseEntryFeeFields(body) };
  if (allowRebuys !== undefined) rules.allowRebuys = Boolean(allowRebuys);
  if (allowAddOn !== undefined) rules.allowAddOn = Boolean(allowAddOn);
  if (rebuyLimitType !== undefined) {
    if (!["unlimited", "limited"].includes(rebuyLimitType)) {
      throw new Error("rebuyLimitType must be 'unlimited' or 'limited'");
    }
    if (rebuyLimitType === "limited" && !(Number.isInteger(maxRebuysPerPlayer) && maxRebuysPerPlayer > 0)) {
      throw new Error("maxRebuysPerPlayer must be a positive integer when rebuys are limited");
    }
    rules.rebuyLimitType = rebuyLimitType;
    rules.maxRebuysPerPlayer = rebuyLimitType === "limited" ? maxRebuysPerPlayer : null;
  }
  // Soft cross-check only — only enforced when the same request also sends
  // the blind structure (levels isn't itself a parseRebuyRules concern).
  if (rules.rebuyCutoffLevel != null && Array.isArray(body?.levels) && rules.rebuyCutoffLevel > body.levels.length) {
    throw new Error(`rebuyCutoffLevel can't exceed the number of configured levels (${body.levels.length})`);
  }
  return rules;
}

// Builds a complete, cross-field-validated prizeConfig by merging whatever
// fields the client sent (via prizePool.parsePrizeConfigFields) onto an
// existing config — DEFAULT_PRIZE_CONFIG for a brand-new template/tournament,
// or the live/template's current config for an update.
function buildPrizeConfig(body, existing = DEFAULT_PRIZE_CONFIG) {
  const updates = parsePrizeConfigFields(body?.prizeConfig);
  const merged = { ...existing, ...updates };
  assertValidPrizeConfig(merged);
  return merged;
}

function serializeTemplate(t) {
  return {
    templateId: t._id,
    ownerUsername: t.ownerUsername,
    admins: t.admins,
    name: t.name,
    levels: t.levels,
    startingStack: t.startingStack,
    allowRebuys: t.allowRebuys,
    rebuyLimitType: t.rebuyLimitType,
    maxRebuysPerPlayer: t.maxRebuysPerPlayer,
    allowAddOn: t.allowAddOn,
    buyInAmount: t.buyInAmount,
    rebuyAmount: t.rebuyAmount,
    addOnAmount: t.addOnAmount,
    customRebuyPricesEnabled: t.customRebuyPricesEnabled,
    rebuyPricesByIndex: t.rebuyPricesByIndex,
    rebuyCutoffLevel: t.rebuyCutoffLevel,
    prizeConfig: t.prizeConfig,
    source: t.source,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

app.post("/api/templates", requireAuth, async (req, res) => {
  const { name, levels, startingStack } = req.body || {};
  if (!name || !Array.isArray(levels) || levels.length === 0 || !startingStack) {
    return res.status(400).json({ error: "name, levels, and startingStack are required" });
  }

  let normalizedLevels;
  let rebuyRules;
  let prizeConfig;
  try {
    normalizedLevels = normalizeLevels(levels);
    rebuyRules = parseRebuyRules(req.body);
    prizeConfig = buildPrizeConfig(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  const template = await createTemplate(req.username, {
    name,
    levels: normalizedLevels,
    startingStack,
    ...rebuyRules,
    prizeConfig,
    source: "manual",
  });
  res.status(201).json(serializeTemplate(template));
});

app.get("/api/templates", requireAuth, async (req, res) => {
  const templates = await listTemplatesForUser(req.username);
  res.json({ templates: templates.map(serializeTemplate) });
});

app.put("/api/templates/:id", requireAuth, async (req, res) => {
  const { name, levels, startingStack, prizeConfig } = req.body || {};
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
  try {
    Object.assign(updates, parseRebuyRules(req.body));
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  if (prizeConfig !== undefined) {
    const existing = await getTemplate(req.params.id, req.username);
    if (!existing) {
      return res.status(404).json({ error: "Template not found" });
    }
    try {
      updates.prizeConfig = buildPrizeConfig(req.body, existing.prizeConfig);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }

  const template = await updateTemplate(req.params.id, req.username, updates);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.json(serializeTemplate(template));
});

app.delete("/api/templates/:id", requireAuth, async (req, res) => {
  const template = await deleteTemplate(req.params.id, req.username);
  if (!template) {
    return res.status(404).json({ error: "Template not found" });
  }
  res.status(204).end();
});

app.post("/api/tournaments", requireAuth, async (req, res) => {
  const { templateId, name, levels, startingStack } = req.body || {};

  if (!name || !name.trim()) {
    return res.status(400).json({ error: "Tournament name is required" });
  }

  const seed = { name: name.trim() };
  try {
    Object.assign(seed, parseRebuyRules(req.body));
    seed.prizeConfig = buildPrizeConfig(req.body);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (levels !== undefined) {
    try {
      seed.levels = normalizeLevels(levels);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }
  }
  if (startingStack !== undefined) seed.startingStack = startingStack;

  if (templateId) {
    // Traceability only — the Setup page sends its own (possibly edited)
    // levels/startingStack/rebuy rules in the body above, not re-fetched
    // from the template. Launching never mutates the template itself; that
    // only happens through the explicit "Save as Template" action, so an
    // edited-then-launched config doesn't silently overwrite the original.
    const template = await getTemplate(templateId, req.username);
    if (!template) {
      return res.status(404).json({ error: "Template not found" });
    }
    seed.templateId = template._id;
  } else {
    // Quick Launch: there's nowhere else this configuration is saved, so
    // auto-save it as a template (tagged quick_launch) before launching.
    const autoTemplate = await createTemplate(req.username, {
      name: seed.name || `Quick Launch - ${new Date().toLocaleString()}`,
      levels: seed.levels || cloneLevels(defaultLevels),
      startingStack: seed.startingStack ?? 1000,
      allowRebuys: seed.allowRebuys ?? true,
      rebuyLimitType: seed.rebuyLimitType ?? "unlimited",
      maxRebuysPerPlayer: seed.maxRebuysPerPlayer ?? null,
      allowAddOn: seed.allowAddOn ?? false,
      buyInAmount: seed.buyInAmount ?? 0,
      rebuyAmount: seed.rebuyAmount ?? 0,
      addOnAmount: seed.addOnAmount ?? 0,
      customRebuyPricesEnabled: seed.customRebuyPricesEnabled ?? false,
      rebuyPricesByIndex: seed.rebuyPricesByIndex ?? [],
      rebuyCutoffLevel: seed.rebuyCutoffLevel ?? null,
      prizeConfig: seed.prizeConfig,
      source: "quick_launch",
    });
    seed.templateId = autoTemplate._id;
  }

  const tournament = await createTournament(req.username, seed);
  res.status(201).json({ tournamentId: tournament.id, templateId: String(seed.templateId) });
});

app.get("/api/tournaments", requireAuth, (req, res) => {
  const owned = listOwnedTournaments(req.username).map((t) => ({
    tournamentId: t.id,
    name: t.name,
    createdAt: t.createdAt,
    status: t.clock.getState().status,
    playerCount: t.players.length,
  }));
  const managed = listManagedTournaments(req.username).map((t) => ({
    tournamentId: t.id,
    name: t.name,
    createdAt: t.createdAt,
    status: t.clock.getState().status,
    playerCount: t.players.length,
    ownerUsername: t.ownerUsername,
  }));
  // Minimal on purpose — an un-accepted invitation shouldn't expose live
  // player/clock data before the invitee has agreed to co-manage.
  const pending = listPendingInvitations(req.username).map((t) => ({
    tournamentId: t.id,
    name: t.name,
    ownerUsername: t.ownerUsername,
    createdAt: t.createdAt,
  }));
  res.json({ owned, managed, pending });
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
  try {
    await createHistory(tournament);
  } catch (err) {
    console.error(`[history] snapshot failed for tournament ${tournament.id}:`, err);
  }
  try {
    // Recomputed (not incremented) from TournamentHistory, which the
    // createHistory call above just wrote — see playerStore.js.
    await recomputePlayerStatsForOwner(tournament.ownerUsername);
  } catch (err) {
    console.error(`[players] stat recompute failed for tournament ${tournament.id}:`, err);
  }
  res.json({ ok: true });
});

app.get("/api/history", requireAuth, async (req, res) => {
  const { tournamentId } = req.query;
  const history = await listHistoryForUser(req.username, { tournamentId });
  res.json({
    history: history.map((h) => ({
      historyId: h._id,
      tournamentId: h.tournamentId,
      name: h.name,
      ownerUsername: h.ownerUsername,
      startedAt: h.startedAt,
      endedAt: h.endedAt,
      grossDurationMs: h.grossDurationMs,
      activeDurationMs: h.activeDurationMs,
      uniquePlayers: h.uniquePlayers,
      totalEntries: h.totalEntries,
      finalLevelIndex: h.finalLevelIndex,
      finalLevel: h.finalLevel,
    })),
  });
});

app.get("/api/history/:id", requireAuth, async (req, res) => {
  const history = await getHistoryById(req.params.id, req.username);
  if (!history) {
    return res.status(404).json({ error: "History entry not found" });
  }
  res.json({
    historyId: history._id,
    tournamentId: history.tournamentId,
    ownerUsername: history.ownerUsername,
    admins: history.admins,
    name: history.name,
    startingStack: history.startingStack,
    levels: history.levels,
    allowRebuys: history.allowRebuys,
    rebuyLimitType: history.rebuyLimitType,
    maxRebuysPerPlayer: history.maxRebuysPerPlayer,
    allowAddOn: history.allowAddOn,
    buyInAmount: history.buyInAmount,
    rebuyAmount: history.rebuyAmount,
    addOnAmount: history.addOnAmount,
    customRebuyPricesEnabled: history.customRebuyPricesEnabled,
    rebuyPricesByIndex: history.rebuyPricesByIndex,
    rebuyCutoffLevel: history.rebuyCutoffLevel,
    prizeConfig: history.prizeConfig,
    finalPrizePool: history.finalPrizePool,
    finalPayouts: history.finalPayouts,
    startedAt: history.startedAt,
    endedAt: history.endedAt,
    grossDurationMs: history.grossDurationMs,
    activeDurationMs: history.activeDurationMs,
    totalEntries: history.totalEntries,
    uniquePlayers: history.uniquePlayers,
    totalRebuys: history.totalRebuys,
    totalAddOns: history.totalAddOns,
    finalLevelIndex: history.finalLevelIndex,
    finalLevel: history.finalLevel,
    players: history.players,
    events: history.events,
  });
});

function serializePlayer(p) {
  return {
    playerId: p._id,
    name: p.name,
    nickname: p.nickname,
    notes: p.notes,
    phone: p.phone,
    tournamentsPlayed: p.tournamentsPlayed,
    lastPlayedAt: p.lastPlayedAt,
    createdAt: p.createdAt,
  };
}

// Players directory is owner-only (not shared with floor admins) — a
// simpler scope than templates/history/tournaments, and not something the
// feature asked to extend to co-admins.
app.get("/api/players", requireAuth, async (req, res) => {
  const { search, sort } = req.query;
  const players = await listPlayersByOwner(req.username, { search, sort });
  res.json({ players: players.map(serializePlayer) });
});

app.post("/api/players", requireAuth, async (req, res) => {
  const { name, nickname, notes, phone } = req.body || {};
  try {
    const player = await createPlayer(req.username, { name, nickname, notes, phone });
    res.status(201).json(serializePlayer(player));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.patch("/api/players/:id", requireAuth, async (req, res) => {
  const { name, nickname, notes, phone } = req.body || {};
  try {
    const player = await updatePlayer(req.params.id, req.username, { name, nickname, notes, phone });
    if (!player) {
      return res.status(404).json({ error: "Player not found" });
    }
    res.json(serializePlayer(player));
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete("/api/players/:id", requireAuth, async (req, res) => {
  const player = await deletePlayer(req.params.id, req.username);
  if (!player) {
    return res.status(404).json({ error: "Player not found" });
  }
  res.status(204).end();
});

// Admin management is strictly owner-only — admins can run gameplay actions
// (enforced via isManagedBy below) but can't grant/revoke access themselves.
app.get("/api/tournaments/:id/admins", requireAuth, (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament || tournament.ownerUsername !== req.username) {
    return res.status(404).json({ error: "Tournament not found" });
  }
  const resolve = (username) => ({ username, email: findUser(username)?.email || username });
  res.json({
    ownerUsername: tournament.ownerUsername,
    admins: tournament.admins.map(resolve),
    pendingAdmins: tournament.pendingAdmins.map(resolve),
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
    tournament.inviteAdmin(user.username);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  broadcastTournament(tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] inviteAdmin failed for tournament ${tournament.id}:`, err);
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

// Self-service — the invitee acts on their own invitation, no owner check.
app.post("/api/tournaments/:id/invitations/accept", requireAuth, async (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }

  try {
    tournament.acceptInvitation(req.username);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }

  broadcastTournament(tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] acceptInvitation failed for tournament ${tournament.id}:`, err);
  }
  if (tournament.templateId) {
    try {
      await addTemplateAdmin(tournament.templateId, req.username);
    } catch (err) {
      console.error(`[template] addTemplateAdmin failed for tournament ${tournament.id}:`, err);
    }
  }
  res.json({ ok: true });
});

app.post("/api/tournaments/:id/invitations/decline", requireAuth, async (req, res) => {
  const tournament = getTournament(req.params.id);
  if (!tournament) {
    return res.status(404).json({ error: "Tournament not found" });
  }

  tournament.declineInvitation(req.username);
  broadcastTournament(tournament);
  try {
    await persistTournament(tournament);
  } catch (err) {
    console.error(`[persist] declineInvitation failed for tournament ${tournament.id}:`, err);
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

  // `afterPersist`, when given, receives mutate()'s return value — used by
  // manager:addPlayer below to upsert the player directory with the
  // resolved name (Quick Add defaults an empty name server-side).
  function onManagerAction(event, mutate, afterPersist) {
    socket.on(event, ({ tournamentId, ...payload } = {}, ack) => {
      try {
        const tournament = requireOwnedTournament(socket, tournamentId);
        const result = mutate(tournament, payload);
        broadcastTournament(tournament);
        ack?.({ ok: true });
        // Fire-and-forget: a Mongo hiccup must never stall the live clock or
        // the ack the client already received (see tournamentStore.js).
        persistTournament(tournament).catch((err) =>
          console.error(`[persist] ${event} failed for tournament ${tournamentId}:`, err),
        );
        afterPersist?.(tournament, result)?.catch?.((err) =>
          console.error(`[players] ${event} directory sync failed for tournament ${tournamentId}:`, err),
        );
      } catch (error) {
        ack?.({ ok: false, error: error.message });
      }
    });
  }

  onManagerAction("manager:start", (t) => t.start());
  onManagerAction("manager:pause", (t) => t.pause());
  onManagerAction("manager:reset", (t) => t.reset());
  onManagerAction("manager:skipLevel", (t) => t.skipLevel());
  onManagerAction("manager:previousLevel", (t) => t.previousLevel());
  onManagerAction("manager:updateStructure", (t, { levels }) => t.updateStructure(levels));
  onManagerAction("manager:updatePrizeConfig", (t, { prizeConfig }) =>
    t.updatePrizeConfig(parsePrizeConfigFields(prizeConfig)),
  );
  onManagerAction("manager:updateEntryFees", (t, payload) => t.updateEntryFees(parseEntryFeeFields(payload)));
  onManagerAction(
    "manager:addPlayer",
    (t, { name }) => t.addPlayer(name),
    (t, player) => upsertPlayerSeen(t.ownerUsername, player.name),
  );
  onManagerAction("manager:removePlayer", (t, { playerId }) => t.removePlayer(playerId));
  onManagerAction("manager:eliminatePlayer", (t, { playerId }) => t.eliminatePlayer(playerId));
  onManagerAction("manager:reinstatePlayer", (t, { playerId }) => t.reinstatePlayer(playerId));
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

  // Best-effort, not boot-fatal: backfills the player directory from
  // existing TournamentHistory. Safe to run on every boot (see
  // playerStore.recomputePlayerStatsForOwner).
  try {
    await backfillPlayerStatsFromHistory();
  } catch (err) {
    console.error("[players] startup backfill failed:", err);
  }

  httpServer.listen(PORT, () => {
    console.log(`Poker clock server listening on port ${PORT}`);
  });
}

start();
