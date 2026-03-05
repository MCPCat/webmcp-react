import React from "react";
import { LetterStatus } from "../game/engine";
import "./Keyboard.css";

const ROWS = [
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
  ["ENTER", "Z", "X", "C", "V", "B", "N", "M", "BACK"],
];

interface KeyboardProps {
  letterStatuses: Map<string, LetterStatus>;
  onKey: (key: string) => void;
  disabled: boolean;
}

export default function Keyboard({ letterStatuses, onKey, disabled }: KeyboardProps) {
  return (
    <div className="keyboard">
      {ROWS.map((row, rowIndex) => (
        <div className="keyboard-row" key={rowIndex}>
          {row.map((key) => {
            const status = letterStatuses.get(key.toLowerCase()) ?? "";
            const isWide = key === "ENTER" || key === "BACK";
            const className = [
              "keyboard-key",
              status,
              isWide ? "wide" : "",
            ]
              .filter(Boolean)
              .join(" ");

            return (
              <button
                key={key}
                className={className}
                onClick={() => onKey(key)}
                disabled={disabled}
              >
                {key === "BACK" ? "\u232B" : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
