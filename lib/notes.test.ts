import { describe, expect, it } from "vitest";
import { MAX_NOTE_LENGTH, clampNote } from "./notes";

describe("clampNote", () => {
  it("leaves short notes untouched", () => {
    expect(clampNote("Lazarus was on fire today.")).toBe(
      "Lazarus was on fire today.",
    );
  });

  it("enforces the 500-character limit", () => {
    const long = "a".repeat(600);
    expect(clampNote(long)).toHaveLength(MAX_NOTE_LENGTH);
  });

  it("handles an empty string", () => {
    expect(clampNote("")).toBe("");
  });
});
