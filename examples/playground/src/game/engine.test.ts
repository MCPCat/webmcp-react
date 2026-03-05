import { describe, it, expect } from "vitest";
import {
  evaluateGuess,
  getLetterStatuses,
  getUnusedLetters,
  getKnownPattern,
  validateHardMode,
  type LetterResult,
} from "./engine";

describe("evaluateGuess", () => {
  it("marks all letters correct when guess matches target", () => {
    const result = evaluateGuess("CRANE", "CRANE");
    expect(result).toEqual([
      { letter: "c", status: "correct" },
      { letter: "r", status: "correct" },
      { letter: "a", status: "correct" },
      { letter: "n", status: "correct" },
      { letter: "e", status: "correct" },
    ]);
  });

  it("marks all letters absent when no letters match", () => {
    const result = evaluateGuess("PLUMB", "NIGHT");
    expect(result).toEqual([
      { letter: "p", status: "absent" },
      { letter: "l", status: "absent" },
      { letter: "u", status: "absent" },
      { letter: "m", status: "absent" },
      { letter: "b", status: "absent" },
    ]);
  });

  it("marks letters as present when in wrong position", () => {
    const result = evaluateGuess("RENAL", "CRANE");
    // R is in target (pos 1) but guessed at pos 0 -> present
    // E is in target (pos 4) but guessed at pos 1 -> present
    // N is in target (pos 3) but guessed at pos 2 -> present
    // A is in target (pos 2) but guessed at pos 3 -> present
    // L is not in target -> absent
    expect(result).toEqual([
      { letter: "r", status: "present" },
      { letter: "e", status: "present" },
      { letter: "n", status: "present" },
      { letter: "a", status: "present" },
      { letter: "l", status: "absent" },
    ]);
  });

  it("green consumes before yellow with duplicate letters (GOOSE vs MOOSE)", () => {
    const result = evaluateGuess("GOOSE", "MOOSE");
    // G vs M -> absent
    // O vs O -> correct
    // O vs O -> correct
    // S vs S -> correct
    // E vs E -> correct
    expect(result).toEqual([
      { letter: "g", status: "absent" },
      { letter: "o", status: "correct" },
      { letter: "o", status: "correct" },
      { letter: "s", status: "correct" },
      { letter: "e", status: "correct" },
    ]);
  });

  it("only awards one yellow when target has one instance of that letter", () => {
    // Guess ALLOY against PLUMB:
    // Target has one L at position 1.
    // Guess has L at positions 1 (correct) and 2 (should be absent since the single L is consumed by the green).
    const result = evaluateGuess("ALLOY", "PLUMB");
    // A vs P -> absent
    // L vs L -> correct
    // L: only one L in target, already consumed -> absent
    // O vs M -> absent
    // Y vs B -> absent
    expect(result).toEqual([
      { letter: "a", status: "absent" },
      { letter: "l", status: "correct" },
      { letter: "l", status: "absent" },
      { letter: "o", status: "absent" },
      { letter: "y", status: "absent" },
    ]);
  });

  it("gives only one yellow for duplicate guess letters when target has one instance", () => {
    // Guess HELLO against ANGER: no letters overlap -> all absent except...
    // Actually let's pick a clearer example:
    // Guess LLAMA against CLASP: target has one L at position 1
    // L at position 0: not exact match, but L is in pool at index 1 -> present (consumes pool[1])
    // L at position 1: target[1] is 'l' -> correct... wait let me think about this.
    // target = CLASP -> c, l, a, s, p
    // guess  = LLAMA -> l, l, a, m, a
    // Pass 1: position 1: guess l vs target l -> correct, pool[1] = ""
    //         position 2: guess a vs target a -> correct, pool[2] = ""
    // Pool after pass 1: ["c", "", "", "s", "p"]
    // Pass 2: position 0: guess l, pool has no 'l' -> absent
    //         position 3: guess m, pool has no 'm' -> absent
    //         position 4: guess a, pool has no 'a' -> absent
    const result = evaluateGuess("LLAMA", "CLASP");
    expect(result).toEqual([
      { letter: "l", status: "absent" },
      { letter: "l", status: "correct" },
      { letter: "a", status: "correct" },
      { letter: "m", status: "absent" },
      { letter: "a", status: "absent" },
    ]);
  });
});

describe("getLetterStatuses", () => {
  it("returns highest priority status per letter across multiple guesses", () => {
    const guesses: LetterResult[][] = [
      // First guess: 'a' is absent, 'b' is present
      [
        { letter: "a", status: "absent" },
        { letter: "b", status: "present" },
        { letter: "c", status: "absent" },
        { letter: "d", status: "absent" },
        { letter: "e", status: "absent" },
      ],
      // Second guess: 'a' is present (upgrades from absent), 'b' is correct (upgrades from present)
      [
        { letter: "a", status: "present" },
        { letter: "b", status: "correct" },
        { letter: "f", status: "absent" },
        { letter: "g", status: "absent" },
        { letter: "h", status: "absent" },
      ],
    ];

    const statuses = getLetterStatuses(guesses);

    expect(statuses.get("a")).toBe("present");
    expect(statuses.get("b")).toBe("correct");
    expect(statuses.get("c")).toBe("absent");
    expect(statuses.get("f")).toBe("absent");
  });

  it("does not downgrade a status with a lower-priority one", () => {
    const guesses: LetterResult[][] = [
      [
        { letter: "x", status: "correct" },
        { letter: "y", status: "absent" },
        { letter: "z", status: "absent" },
        { letter: "w", status: "absent" },
        { letter: "v", status: "absent" },
      ],
      [
        { letter: "x", status: "absent" },
        { letter: "y", status: "absent" },
        { letter: "z", status: "absent" },
        { letter: "w", status: "absent" },
        { letter: "v", status: "absent" },
      ],
    ];

    const statuses = getLetterStatuses(guesses);
    expect(statuses.get("x")).toBe("correct");
  });
});

describe("getUnusedLetters", () => {
  it("excludes guessed letters and includes unguessed ones", () => {
    const guesses: LetterResult[][] = [
      [
        { letter: "a", status: "absent" },
        { letter: "b", status: "absent" },
        { letter: "c", status: "absent" },
        { letter: "d", status: "absent" },
        { letter: "e", status: "absent" },
      ],
    ];

    const unused = getUnusedLetters(guesses);

    // a-e should be excluded
    expect(unused).not.toContain("A");
    expect(unused).not.toContain("B");
    expect(unused).not.toContain("C");
    expect(unused).not.toContain("D");
    expect(unused).not.toContain("E");

    // f-z should be included (21 letters)
    expect(unused).toHaveLength(21);
    expect(unused).toContain("F");
    expect(unused).toContain("Z");
  });

  it("returns all 26 letters when no guesses have been made", () => {
    const unused = getUnusedLetters([]);
    expect(unused).toHaveLength(26);
    expect(unused[0]).toBe("A");
    expect(unused[25]).toBe("Z");
  });

  it("returns uppercase letters", () => {
    const unused = getUnusedLetters([]);
    for (const letter of unused) {
      expect(letter).toBe(letter.toUpperCase());
    }
  });
});

describe("getKnownPattern", () => {
  it("shows correct letters in position and underscores elsewhere", () => {
    const guesses: LetterResult[][] = [
      [
        { letter: "c", status: "correct" },
        { letter: "r", status: "absent" },
        { letter: "a", status: "present" },
        { letter: "n", status: "absent" },
        { letter: "e", status: "correct" },
      ],
    ];

    const pattern = getKnownPattern(guesses);
    expect(pattern).toBe("C___E");
  });

  it("accumulates correct letters across multiple guesses", () => {
    const guesses: LetterResult[][] = [
      [
        { letter: "c", status: "correct" },
        { letter: "r", status: "absent" },
        { letter: "a", status: "absent" },
        { letter: "n", status: "absent" },
        { letter: "e", status: "absent" },
      ],
      [
        { letter: "c", status: "correct" },
        { letter: "l", status: "absent" },
        { letter: "i", status: "absent" },
        { letter: "m", status: "correct" },
        { letter: "b", status: "absent" },
      ],
    ];

    const pattern = getKnownPattern(guesses);
    expect(pattern).toBe("C__M_");
  });

  it("returns all underscores when no letters are correct", () => {
    const guesses: LetterResult[][] = [
      [
        { letter: "x", status: "absent" },
        { letter: "y", status: "absent" },
        { letter: "z", status: "present" },
        { letter: "w", status: "absent" },
        { letter: "v", status: "absent" },
      ],
    ];

    const pattern = getKnownPattern(guesses);
    expect(pattern).toBe("_____");
  });
});

describe("validateHardMode", () => {
  it("returns null for a valid guess", () => {
    const previousGuesses: LetterResult[][] = [
      [
        { letter: "c", status: "correct" },
        { letter: "r", status: "absent" },
        { letter: "a", status: "present" },
        { letter: "n", status: "absent" },
        { letter: "e", status: "absent" },
      ],
    ];

    // Guess must have 'c' at position 0 and 'a' somewhere
    const result = validateHardMode("CHAOS", previousGuesses);
    expect(result).toBeNull();
  });

  it("returns error when missing a correct-position letter", () => {
    const previousGuesses: LetterResult[][] = [
      [
        { letter: "c", status: "correct" },
        { letter: "r", status: "absent" },
        { letter: "a", status: "absent" },
        { letter: "n", status: "absent" },
        { letter: "e", status: "absent" },
      ],
    ];

    // Guess does not have 'c' at position 0
    const result = validateHardMode("PLUMB", previousGuesses);
    expect(result).toBe("Position 1 must be C");
  });

  it("returns error when missing a present letter", () => {
    const previousGuesses: LetterResult[][] = [
      [
        { letter: "c", status: "correct" },
        { letter: "r", status: "absent" },
        { letter: "a", status: "present" },
        { letter: "n", status: "absent" },
        { letter: "e", status: "absent" },
      ],
    ];

    // Guess has 'c' at position 0 but is missing 'a'
    const result = validateHardMode("CLIMB", previousGuesses);
    expect(result).toBe("Guess must contain A");
  });

  it("returns null when no previous guesses exist", () => {
    const result = validateHardMode("CRANE", []);
    expect(result).toBeNull();
  });
});
