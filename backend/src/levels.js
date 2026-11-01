// Default blind structure for a home tournament. Durations are in seconds.
export const defaultLevels = [
  { level: 1, smallBlind: 25, bigBlind: 50, ante: 0, durationSeconds: 900, isBreak: false },
  { level: 2, smallBlind: 50, bigBlind: 100, ante: 0, durationSeconds: 900, isBreak: false },
  { level: 3, smallBlind: 75, bigBlind: 150, ante: 0, durationSeconds: 900, isBreak: false },
  { level: 4, smallBlind: 100, bigBlind: 200, ante: 25, durationSeconds: 900, isBreak: false },
  { level: 5, smallBlind: 150, bigBlind: 300, ante: 25, durationSeconds: 900, isBreak: false },
  { level: 6, smallBlind: 0, bigBlind: 0, ante: 0, durationSeconds: 600, isBreak: true },
  { level: 7, smallBlind: 200, bigBlind: 400, ante: 50, durationSeconds: 900, isBreak: false },
  { level: 8, smallBlind: 300, bigBlind: 600, ante: 75, durationSeconds: 900, isBreak: false },
  { level: 9, smallBlind: 400, bigBlind: 800, ante: 100, durationSeconds: 900, isBreak: false },
  { level: 10, smallBlind: 500, bigBlind: 1000, ante: 100, durationSeconds: 900, isBreak: false },
  { level: 11, smallBlind: 0, bigBlind: 0, ante: 0, durationSeconds: 600, isBreak: true },
  { level: 12, smallBlind: 600, bigBlind: 1200, ante: 200, durationSeconds: 900, isBreak: false },
  { level: 13, smallBlind: 800, bigBlind: 1600, ante: 200, durationSeconds: 900, isBreak: false },
  { level: 14, smallBlind: 1000, bigBlind: 2000, ante: 300, durationSeconds: 900, isBreak: false },
  { level: 15, smallBlind: 1500, bigBlind: 3000, ante: 300, durationSeconds: 900, isBreak: false },
];

export function cloneLevels(levels) {
  return levels.map((level) => ({ ...level }));
}
