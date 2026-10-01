import type { Context } from "../lib/context";

export const REVIEW_EVALUATOR = Symbol.for("nearbuilders.proposals.reviewEvaluator");

export const evaluatorContext = { [REVIEW_EVALUATOR]: true } as unknown as Context;
