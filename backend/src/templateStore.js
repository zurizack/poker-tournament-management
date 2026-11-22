import { TournamentTemplate } from "./models/TournamentTemplate.js";

// Thin CRUD wrapper around TournamentTemplate, matching the *Store.js
// pattern used by userStore.js/tournamentStore.js. Templates aren't on a hot
// per-second path, so there's no in-memory cache here — every call talks to
// Mongo directly. ownerUsername is baked into every filter (not checked
// after a separate fetch) so ownership enforcement is atomic.
export async function createTemplate(
  ownerUsername,
  {
    name,
    levels,
    startingStack,
    allowRebuys,
    rebuyLimitType,
    maxRebuysPerPlayer,
    allowAddOn,
    buyInAmount,
    rebuyAmount,
    addOnAmount,
    prizeConfig,
    source,
  },
) {
  return TournamentTemplate.create({
    ownerUsername,
    name,
    levels,
    startingStack,
    allowRebuys,
    rebuyLimitType,
    maxRebuysPerPlayer,
    allowAddOn,
    buyInAmount,
    rebuyAmount,
    addOnAmount,
    prizeConfig,
    source,
  });
}

// Read access (list + single lookup) is shared with floor admins, same
// access rule as tournaments/history. Writes (update/delete below) stay
// owner-only so a floor admin can view and launch from a shared template
// but can't mutate or remove someone else's.
export async function listTemplatesForUser(username) {
  return TournamentTemplate.find({ $or: [{ ownerUsername: username }, { admins: username }] })
    .sort({ createdAt: -1 })
    .lean();
}

export async function getTemplate(id, username) {
  try {
    return await TournamentTemplate.findOne({
      _id: id,
      $or: [{ ownerUsername: username }, { admins: username }],
    }).lean();
  } catch {
    return null; // malformed ObjectId -> treat as not-found, not a 500
  }
}

// Fire-and-forget from acceptInvitation — adds the accepting admin to the
// template's admins so they also see/launch it going forward. Not revoked
// if they're later removed from the tournament (see templateStore's header
// comment on TournamentTemplate.admins).
export async function addTemplateAdmin(id, username) {
  await TournamentTemplate.findByIdAndUpdate(id, { $addToSet: { admins: username } });
}

export async function updateTemplate(id, ownerUsername, updates) {
  try {
    return await TournamentTemplate.findOneAndUpdate(
      { _id: id, ownerUsername },
      { $set: updates },
      { new: true, runValidators: true },
    );
  } catch {
    return null;
  }
}

export async function deleteTemplate(id, ownerUsername) {
  try {
    return await TournamentTemplate.findOneAndDelete({ _id: id, ownerUsername });
  } catch {
    return null;
  }
}
