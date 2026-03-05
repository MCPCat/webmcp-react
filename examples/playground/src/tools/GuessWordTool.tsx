import { useMcpTool } from "webmcp-react";
import { z } from "zod";
import type { GameState, LetterResult } from "../game/engine";
import { evaluateGuess, validateHardMode, MAX_GUESSES } from "../game/engine";
import { isValidWord } from "../data/words";

interface Props {
  gameState: GameState;
  onGuess: (result: LetterResult[], won: boolean, lost: boolean) => void;
}

const STATUS_EMOJI: Record<string, string> = {
  correct: "🟩",
  present: "🟨",
  absent: "⬛",
};

export function GuessWordTool({ gameState, onGuess }: Props) {
  useMcpTool({
    name: "guess_word",
    description: "Guess a 5-letter word in the current Wordle game.",
    input: z.object({
      word: z.string().length(5).describe("A 5-letter word guess."),
    }),
    handler: async ({ word }) => {
      const guess = word.toUpperCase();

      if (!isValidWord(guess)) {
        return {
          content: [{ type: "text", text: `"${guess}" is not a valid 5-letter word.` }],
          isError: true,
        };
      }

      if (gameState.difficulty === "hard") {
        const hardModeError = validateHardMode(guess, gameState.guesses);
        if (hardModeError) {
          return {
            content: [{ type: "text", text: `Hard mode violation: ${hardModeError}` }],
            isError: true,
          };
        }
      }

      const result = evaluateGuess(guess, gameState.targetWord);
      const won = result.every((r) => r.status === "correct");
      const lost = !won && gameState.guesses.length + 1 >= MAX_GUESSES;

      onGuess(result, won, lost);

      const emojiRow = result.map((r) => STATUS_EMOJI[r.status]).join("");
      const remaining = MAX_GUESSES - (gameState.guesses.length + 1);

      let feedback = `${guess}: ${emojiRow}`;
      if (won) {
        feedback += `\nCongratulations! You guessed the word in ${gameState.guesses.length + 1} attempt(s)!`;
      } else if (lost) {
        feedback += `\nGame over! The word was ${gameState.targetWord}.`;
      } else {
        feedback += `\n${remaining} attempt(s) remaining.`;
      }

      return {
        content: [{ type: "text", text: feedback }],
      };
    },
  });
  return null;
}
