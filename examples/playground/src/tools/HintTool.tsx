import { useMcpTool } from "webmcp-react";
import type { GameState } from "../game/engine";
import { getUnusedLetters, getKnownPattern } from "../game/engine";

interface Props {
  gameState: GameState;
}

export function HintTool({ gameState }: Props) {
  useMcpTool({
    name: "get_hint",
    description: "Get a hint for the current Wordle game. Choose between seeing unused letters or the known letter pattern.",
    inputSchema: {
      type: "object",
      properties: {
        hint_type: {
          type: "string",
          enum: ["unused_letters", "pattern"],
          description: "unused_letters shows letters not yet tried, pattern shows known positions",
        },
      },
      required: ["hint_type"],
    },
    annotations: { readOnlyHint: true },
    handler: async (args) => {
      const { hint_type } = args as { hint_type: "unused_letters" | "pattern" };

      if (hint_type === "unused_letters") {
        const unused = getUnusedLetters(gameState.guesses);
        return {
          content: [{ type: "text", text: `Unused letters: ${unused.join(", ")}` }],
        };
      }

      const pattern = getKnownPattern(gameState.guesses);
      return {
        content: [{ type: "text", text: `Known pattern: ${pattern}` }],
      };
    },
  });
  return null;
}
