export type Fact = { a: number; b: number };
type Rng = () => number;

/** Every times table that can be chosen. */
export const FACTORS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/** The tables on by default. */
export const CORE_FACTORS: readonly number[] = [2, 3, 4, 5, 6, 7, 8, 9];

export const answerOf = (f: Fact) => f.a * f.b;

/** 7 × 8 and 8 × 7 count as the same problem when avoiding repeats. */
const sameProblem = (x: Fact, y: Fact) =>
  (x.a === y.a && x.b === y.b) || (x.a === y.b && x.b === y.a);

/**
 * Every ordered pair of factors where at least one factor is a chosen table.
 * The other factor comes from 2-9 or the chosen tables, so choosing 7 alone
 * asks 7 × 2 through 7 × 9 and never 7 × 0 or 7 × 12.
 */
export function factsFor(tables: readonly number[]): Fact[] {
  const factors = FACTORS.filter((n) => CORE_FACTORS.includes(n) || tables.includes(n));
  const facts: Fact[] = [];
  for (const a of factors) {
    for (const b of factors) {
      if (tables.includes(a) || tables.includes(b)) facts.push({ a, b });
    }
  }
  return facts;
}

function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** An answer is checked as soon as it has as many digits as the right one. */
export const isComplete = (typed: string, fact: Fact) =>
  typed.length >= String(answerOf(fact)).length;

export class Session {
  current: Fact;
  streak = 0;
  correct = 0;
  attempted = 0;

  private deck: Fact[] = [];
  private missedFacts: Fact[] = [];

  constructor(
    private readonly tables: readonly number[],
    private readonly rng: Rng = Math.random,
  ) {
    this.current = this.draw();
  }

  /** Records an answer to the current problem. Call `advance` to move on. */
  submit(given: number): boolean {
    const fact = this.current;
    const right = given === answerOf(fact);
    this.attempted++;
    if (right) {
      this.correct++;
      this.streak++;
    } else {
      this.streak = 0;
      if (!this.missedFacts.some((m) => m.a === fact.a && m.b === fact.b)) {
        this.missedFacts.push(fact);
      }
    }
    return right;
  }

  advance(): Fact {
    this.current = this.draw(this.current);
    return this.current;
  }

  get missed(): readonly Fact[] {
    return this.missedFacts;
  }

  private draw(previous?: Fact): Fact {
    if (this.deck.length === 0) this.deck = this.freshDeck();
    // Skip past a card that repeats the last problem; it comes up next instead.
    let pick = this.deck.length - 1;
    if (previous) {
      const isFresh = (f: Fact) => !sameProblem(f, previous);
      let fresh = this.deck.findLastIndex(isFresh);
      if (fresh < 0) {
        // Only a repeat is left, so deal the next deck underneath it.
        this.deck = [...this.freshDeck(), ...this.deck];
        fresh = this.deck.findLastIndex(isFresh);
      }
      if (fresh >= 0) pick = fresh;
    }
    const [fact] = this.deck.splice(pick, 1);
    if (!fact) throw new Error("No facts to practice: no times tables selected");
    return fact;
  }

  private freshDeck(): Fact[] {
    return shuffle(factsFor(this.tables), this.rng);
  }
}
