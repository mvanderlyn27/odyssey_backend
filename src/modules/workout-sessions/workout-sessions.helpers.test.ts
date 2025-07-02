import { calculate_1RM, calculate_SWR } from "./workout-sessions.helpers";

describe("Workout Session Helpers", () => {
  describe("calculate_1RM", () => {
    it("should return null for invalid inputs", () => {
      expect(calculate_1RM(null, 5)).toBeNull();
      expect(calculate_1RM(100, null)).toBeNull();
      expect(calculate_1RM(-100, 5)).toBeNull();
      expect(calculate_1RM(100, 0)).toBeNull();
    });

    it("should return the weight lifted if reps is 1", () => {
      expect(calculate_1RM(100, 1)).toBe(100);
    });

    it("should calculate the 1RM correctly using the Epley formula", () => {
      expect(calculate_1RM(100, 10)).toBeCloseTo(133.33);
      expect(calculate_1RM(80, 5)).toBeCloseTo(93.33);
    });
  });

  describe("calculate_SWR", () => {
    it("should return null for invalid inputs", () => {
      expect(calculate_SWR(null, 80)).toBeNull();
      expect(calculate_SWR(150, null)).toBeNull();
      expect(calculate_SWR(150, 0)).toBeNull();
      expect(calculate_SWR(150, -80)).toBeNull();
    });

    it("should calculate the SWR correctly", () => {
      expect(calculate_SWR(150, 75)).toBe(2);
      expect(calculate_SWR(100, 80)).toBe(1.25);
    });
  });
});
