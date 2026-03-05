export type LetterStatus = "correct" | "present" | "absent";

export interface LetterResult {
  letter: string;
  status: LetterStatus;
}

export type GamePhase = "idle" | "playing" | "won" | "lost";

export type Difficulty = "normal" | "hard";

export interface GameState {
  phase: GamePhase;
  targetWord: string;
  guesses: LetterResult[][];
  difficulty: Difficulty;
  easyMode: boolean;
}

export const MAX_GUESSES = 6;
export const WORD_LENGTH = 5;

/**
 * Returns a fresh idle game state with empty/default values.
 */
export function createInitialState(): GameState {
  return {
    phase: "idle",
    targetWord: "",
    guesses: [],
    difficulty: "normal",
    easyMode: false,
  };
}

/**
 * Evaluate a 5-letter guess against the target word.
 *
 * Uses two passes to handle duplicate letters correctly:
 *   Pass 1 — mark exact positional matches as "correct" and remove
 *            those letters from the remaining target pool.
 *   Pass 2 — for each non-correct letter, mark "present" if it still
 *            exists in the pool (consuming it), otherwise "absent".
 */
export function evaluateGuess(guess: string, target: string): LetterResult[] {
  const guessLower = guess.toLowerCase();
  const targetLower = target.toLowerCase();

  const results: LetterResult[] = Array.from({ length: WORD_LENGTH }, (_, i) => ({
    letter: guessLower[i],
    status: "absent" as LetterStatus,
  }));

  // Remaining target letters available for "present" matching.
  const pool = targetLower.split("");

  // Pass 1: exact matches
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guessLower[i] === targetLower[i]) {
      results[i].status = "correct";
      pool[i] = ""; // consume this target letter
    }
  }

  // Pass 2: present / absent
  for (let i = 0; i < WORD_LENGTH; i++) {
    if (results[i].status === "correct") continue;

    const poolIndex = pool.indexOf(guessLower[i]);
    if (poolIndex !== -1) {
      results[i].status = "present";
      pool[poolIndex] = ""; // consume from pool
    }
    // otherwise stays "absent"
  }

  return results;
}

/**
 * Build a map of letter -> best status across all guesses.
 * Priority: correct > present > absent.
 */
export function getLetterStatuses(guesses: LetterResult[][]): Map<string, LetterStatus> {
  const statusPriority: Record<LetterStatus, number> = {
    correct: 2,
    present: 1,
    absent: 0,
  };

  const map = new Map<string, LetterStatus>();

  for (const guess of guesses) {
    for (const { letter, status } of guess) {
      const current = map.get(letter);
      if (current === undefined || statusPriority[status] > statusPriority[current]) {
        map.set(letter, status);
      }
    }
  }

  return map;
}

/**
 * Returns all A-Z letters that have not appeared in any guess.
 */
export function getUnusedLetters(guesses: LetterResult[][]): string[] {
  const used = new Set<string>();
  for (const guess of guesses) {
    for (const { letter } of guess) {
      used.add(letter.toLowerCase());
    }
  }

  const unused: string[] = [];
  for (let code = 97; code <= 122; code++) {
    const ch = String.fromCharCode(code);
    if (!used.has(ch)) {
      unused.push(ch.toUpperCase());
    }
  }

  return unused;
}

/**
 * Returns a pattern string showing confirmed (green) letter positions,
 * e.g. "_E_L_" for a word where E is confirmed at index 1 and L at index 3.
 */
export function getKnownPattern(guesses: LetterResult[][]): string {
  const pattern = Array.from({ length: WORD_LENGTH }, () => "_");

  for (const guess of guesses) {
    for (let i = 0; i < guess.length; i++) {
      if (guess[i].status === "correct") {
        pattern[i] = guess[i].letter.toUpperCase();
      }
    }
  }

  return pattern.join("");
}

/**
 * Validate a guess under hard-mode rules against all previous guesses.
 *
 * Hard mode requires:
 *   - Every green (correct) letter must be reused in the same position.
 *   - Every yellow (present) letter must appear somewhere in the guess.
 *
 * Returns null if the guess is valid, or a human-readable error message.
 */
export function validateHardMode(
  guess: string,
  previousGuesses: LetterResult[][],
): string | null {
  const guessLower = guess.toLowerCase();

  for (const prev of previousGuesses) {
    // Check green letters — must appear in the same position
    for (let i = 0; i < prev.length; i++) {
      if (prev[i].status === "correct") {
        if (guessLower[i] !== prev[i].letter.toLowerCase()) {
          return `Position ${i + 1} must be ${prev[i].letter.toUpperCase()}`;
        }
      }
    }

    // Check yellow letters — must appear somewhere in the guess
    for (const { letter, status } of prev) {
      if (status === "present") {
        if (!guessLower.includes(letter.toLowerCase())) {
          return `Guess must contain ${letter.toUpperCase()}`;
        }
      }
    }
  }

  return null;
}
