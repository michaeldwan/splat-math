import { describe, expect, it } from "vitest";
import { mulberry32 } from "../fx/rng";
import { Session, answerOf, factsFor, isComplete } from "./facts";

const ALL = [2, 3, 4, 5, 6, 7, 8, 9];

describe("factsFor", () => {
  it("covers every pair of 2-9 when all tables are chosen", () => {
    expect(factsFor(ALL)).toHaveLength(64);
  });

  it("keeps only problems with a chosen table as one factor", () => {
    const facts = factsFor([7]);
    expect(facts).toHaveLength(15);
    expect(facts.every((f) => f.a === 7 || f.b === 7)).toBe(true);
  });

  it("pairs an extra table with 2-9 and itself", () => {
    const facts = factsFor([12]);
    expect(facts).toHaveLength(17);
    expect(facts).toContainEqual({ a: 12, b: 12 });
    expect(facts.every((f) => f.a === 12 || f.b === 12)).toBe(true);
  });

  it("covers every pair of 0-12 when every table is chosen", () => {
    expect(factsFor([0, 1, ...ALL, 10, 11, 12])).toHaveLength(169);
  });
});

describe("isComplete", () => {
  it("waits for both digits of a two-digit answer", () => {
    expect(isComplete("5", { a: 7, b: 8 })).toBe(false);
    expect(isComplete("56", { a: 7, b: 8 })).toBe(true);
  });

  it("checks a one-digit answer after one digit", () => {
    expect(isComplete("1", { a: 2, b: 4 })).toBe(true);
  });

  it("checks a zero answer after one digit", () => {
    expect(isComplete("0", { a: 0, b: 7 })).toBe(true);
  });

  it("waits for all three digits of a three-digit answer", () => {
    expect(isComplete("14", { a: 12, b: 12 })).toBe(false);
    expect(isComplete("144", { a: 12, b: 12 })).toBe(true);
  });
});

describe("Session", () => {
  // One more than the 64 facts: the last card of a deck waits a turn when it
  // would repeat the problem before it.
  it("gets through every fact in 65 problems", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const session = new Session(ALL, mulberry32(seed));
      const seen = new Set<string>();
      for (let i = 0; i < 65; i++) {
        seen.add(`${session.current.a}x${session.current.b}`);
        session.advance();
      }
      expect(seen.size).toBe(64);
    }
  });

  it("never shows the same problem, or its mirror, twice in a row", () => {
    const session = new Session([2], mulberry32(7));
    for (let i = 0; i < 200; i++) {
      const before = session.current;
      session.submit(answerOf(before));
      const after = session.advance();
      const mirrored = before.a === after.b && before.b === after.a;
      const same = before.a === after.a && before.b === after.b;
      expect(same || mirrored).toBe(false);
    }
  });

  it("lists a fact once however many times it's missed", () => {
    const session = new Session([2], mulberry32(9));
    const first = session.current;
    let misses = 0;
    for (let i = 0; i < 60; i++) {
      if (session.current.a === first.a && session.current.b === first.b) {
        session.submit(-1);
        misses++;
      }
      session.advance();
    }
    expect(misses).toBeGreaterThan(1);
    expect(session.missed).toEqual([first]);
  });

  it("lists missed facts in the order they were missed", () => {
    const session = new Session(ALL, mulberry32(3));
    const first = session.current;
    expect(session.submit(-1)).toBe(false);
    session.advance();
    session.submit(answerOf(session.current));
    const second = session.advance();
    session.submit(-1);
    expect(session.missed).toEqual([first, second]);
  });

  it("counts right answers and resets the streak on a miss", () => {
    const session = new Session(ALL, mulberry32(5));
    session.submit(answerOf(session.current));
    session.advance();
    session.submit(answerOf(session.current));
    expect(session.streak).toBe(2);
    session.advance();
    session.submit(-1);
    expect(session.streak).toBe(0);
    expect(session.correct).toBe(2);
    expect(session.attempted).toBe(3);
  });
});
