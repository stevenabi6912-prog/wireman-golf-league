import { describe, expect, it } from "vitest";
import { computeTargetDimensions, MAX_PHOTO_EDGE } from "./photos";

describe("computeTargetDimensions", () => {
  it("leaves small images untouched", () => {
    expect(computeTargetDimensions(800, 600)).toEqual({ width: 800, height: 600 });
  });

  it("scales the longest edge down to the max", () => {
    const { width, height } = computeTargetDimensions(4000, 3000);
    expect(Math.max(width, height)).toBe(MAX_PHOTO_EDGE);
    expect(width).toBe(1600);
    expect(height).toBe(1200); // aspect ratio preserved
  });

  it("handles portrait orientation", () => {
    const { width, height } = computeTargetDimensions(3000, 4000);
    expect(Math.max(width, height)).toBe(MAX_PHOTO_EDGE);
    expect(height).toBe(1600);
    expect(width).toBe(1200);
  });
});
