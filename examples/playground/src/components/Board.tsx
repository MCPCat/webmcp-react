import React from "react";
import { LetterResult, MAX_GUESSES, WORD_LENGTH } from "../game/engine";
import "./Board.css";

interface BoardProps {
  guesses: LetterResult[][];
  currentInput: string;
  phase: "idle" | "playing" | "won" | "lost";
}

export const Board: React.FC<BoardProps> = ({ guesses, currentInput, phase }) => {
  const rows: React.ReactNode[] = [];

  // Completed guess rows
  for (let r = 0; r < guesses.length; r++) {
    const guess = guesses[r];
    rows.push(
      <div className="board-row" key={`guess-${r}`}>
        {guess.map((lr, c) => (
          <div key={c} className={`board-cell ${lr.status}`}>
            {lr.letter}
          </div>
        ))}
      </div>,
    );
  }

  // Current input row (only while playing)
  if (phase === "playing" && guesses.length < MAX_GUESSES) {
    const cells: React.ReactNode[] = [];
    for (let c = 0; c < WORD_LENGTH; c++) {
      if (c < currentInput.length) {
        cells.push(
          <div key={c} className="board-cell filled">
            {currentInput[c]}
          </div>,
        );
      } else {
        cells.push(
          <div key={c} className="board-cell empty" />,
        );
      }
    }
    rows.push(
      <div className="board-row" key="current">
        {cells}
      </div>,
    );
  }

  // Empty rows to fill the rest of the grid
  const filledRows = guesses.length + (phase === "playing" && guesses.length < MAX_GUESSES ? 1 : 0);
  for (let r = filledRows; r < MAX_GUESSES; r++) {
    rows.push(
      <div className="board-row" key={`empty-${r}`}>
        {Array.from({ length: WORD_LENGTH }, (_, c) => (
          <div key={c} className="board-cell empty" />
        ))}
      </div>,
    );
  }

  return <div className="board">{rows}</div>;
};

export default Board;
