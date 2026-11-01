import { randomInt } from "crypto";
import { Tournament } from "./tournament.js";

// In-memory tournament registry, keyed by a 6-digit PIN. Resets on restart.
const tournaments = new Map();

function generatePin() {
  let pin;
  do {
    pin = String(randomInt(100000, 1000000));
  } while (tournaments.has(pin));
  return pin;
}

export function createTournament(ownerUsername) {
  const id = generatePin();
  const tournament = new Tournament(id, ownerUsername);
  tournaments.set(id, tournament);
  return tournament;
}

export function getTournament(id) {
  return tournaments.get(id);
}

export function listTournamentsByOwner(ownerUsername) {
  return Array.from(tournaments.values()).filter((t) => t.ownerUsername === ownerUsername);
}

export function allTournaments() {
  return tournaments.values();
}
