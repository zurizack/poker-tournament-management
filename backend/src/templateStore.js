import { TournamentTemplate } from "./models/TournamentTemplate.js";

// Thin CRUD wrapper around TournamentTemplate, matching the *Store.js
// pattern used by userStore.js/tournamentStore.js. Templates aren't on a hot
// per-second path, so there's no in-memory cache here — every call talks to
// Mongo directly. ownerUsername is baked into every filter (not checked
// after a separate fetch) so ownership enforcement is atomic.
export async function createTemplate(ownerUsername, { name, levels, startingStack }) {
  return TournamentTemplate.create({ ownerUsername, name, levels, startingStack });
}

export async function listTemplatesByOwner(ownerUsername) {
  return TournamentTemplate.find({ ownerUsername }).sort({ createdAt: -1 }).lean();
}

export async function getTemplate(id, ownerUsername) {
  try {
    return await TournamentTemplate.findOne({ _id: id, ownerUsername }).lean();
  } catch {
    return null; // malformed ObjectId -> treat as not-found, not a 500
  }
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
