import allWords from "../words.json";

/**
 * Word bank for the Wordle game.
 *
 * ANSWERS contains ~200 common 5-letter words used as target answers.
 * Guess validation uses the full word list from words.json.
 */

const VALID_WORDS: Set<string> = new Set(
  Object.keys(allWords).map((w) => w.toUpperCase())
);

/** Words that can be chosen as the answer. Stored lowercase. */
export const ANSWERS: string[] = [
  "about", "above", "abuse", "actor", "acute",
  "admit", "adopt", "adult", "after", "again",
  "agent", "agree", "ahead", "alarm", "album",
  "alert", "alien", "align", "alive", "alley",
  "allow", "alone", "along", "alter", "among",
  "angel", "anger", "angle", "angry", "ankle",
  "apart", "apple", "apply", "arena", "argue",
  "arise", "armor", "array", "arrow", "aside",
  "asset", "audio", "avoid", "award", "aware",
  "badge", "badly", "baker", "basic", "basin",
  "basis", "beach", "began", "begin", "being",
  "belly", "below", "bench", "berry", "birth",
  "black", "blade", "blame", "bland", "blank",
  "blast", "blaze", "bleed", "blend", "bless",
  "blind", "block", "blood", "bloom", "blown",
  "board", "bonus", "boost", "bound", "brain",
  "brand", "brave", "bread", "break", "breed",
  "brick", "bride", "brief", "bring", "broad",
  "broke", "brook", "brown", "brush", "build",
  "burst", "buyer", "cabin", "candy", "carry",
  "catch", "cause", "cedar", "chain", "chair",
  "charm", "chart", "chase", "cheap", "check",
  "cheek", "cheer", "chest", "chief", "child",
  "china", "claim", "class", "clean", "clear",
  "climb", "cling", "clock", "close", "cloud",
  "coach", "coast", "color", "couch", "could",
  "count", "court", "cover", "crack", "craft",
  "crane", "crash", "crazy", "cream", "crime",
  "cross", "crowd", "crown", "crush", "curve",
  "cycle", "daily", "dance", "debut", "decay",
  "delay", "depth", "derby", "devil", "diary",
  "dirty", "doubt", "dough", "draft", "drain",
  "drama", "drank", "drawn", "dream", "dress",
  "dried", "drift", "drill", "drink", "drive",
  "drown", "dying", "eager", "early", "earth",
  "eight", "elder", "elect", "elite", "empty",
  "enemy", "enjoy", "enter", "entry", "equal",
  "error", "essay", "event", "every", "exact",
  "exist", "extra", "faint", "faith", "fault",
  "feast", "fence", "ferry", "fever", "fiber",
  "field", "fifth", "fifty", "fight", "final",
  "first", "flame", "flash", "flesh", "float",
  "flood", "floor", "flour", "fluid", "flush",
  "focus", "force", "forge", "forth", "forum",
  "found", "frame", "frank", "fraud", "fresh",
  "front", "frost", "fruit", "fully", "funny",
];

/** Checks if a word exists in the full word list. */
export function isValidWord(word: string): boolean {
  return VALID_WORDS.has(word.toUpperCase());
}

/** Returns a random answer from the ANSWERS list, uppercased. */
export function getRandomAnswer(): string {
  const index = Math.floor(Math.random() * ANSWERS.length);
  return ANSWERS[index].toUpperCase();
}
