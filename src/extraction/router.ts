import type { Extractor, ExtractionInput, ExtractionOutcome } from "../domain/types.ts";
import { DeterministicParser, looksLikeKnownGrammar } from "./parsing/deterministic-parser.ts";
import { AIExtractor } from "./ai/ai-extractor.ts";

export type RouteChoice = "deterministic" | "ai";

export function chooseExtractor(input: ExtractionInput): RouteChoice {
  if (input.hasImage) return "ai";
  if (looksLikeKnownGrammar(input.text)) return "deterministic";
  return "ai";
}

export class ExtractionRouter {
  constructor(
    private readonly deterministic: DeterministicParser,
    private readonly ai: AIExtractor
  ) {}

  async extract(input: ExtractionInput): Promise<ExtractionOutcome & { routedTo: RouteChoice; fallbackFromDeterministic: boolean }> {
    const routedTo = chooseExtractor(input);
    if (routedTo === "deterministic") {
      const first = await this.deterministic.extract(input);
      if (first.ok) {
        return { ...first, routedTo, fallbackFromDeterministic: false };
      }
      const fallback = await this.ai.extract(input);
      return { ...fallback, routedTo: "ai", fallbackFromDeterministic: true };
    }
    const aiResult = await this.ai.extract(input);
    return { ...aiResult, routedTo, fallbackFromDeterministic: false };
  }
}

export function createRouter(ai: AIExtractor): ExtractionRouter {
  return new ExtractionRouter(new DeterministicParser(), ai);
}

export type { Extractor };
