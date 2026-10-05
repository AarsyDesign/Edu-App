/**
 * Test Phase 6: Activity Engine — domain contract, renderers, validation.
 *
 * VRD 6.1–6.15: domain contract, 9 activity type renderers, server validation,
 * type-driven renderer, safe failure on invalid payload, test fixtures.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  // Domain types & guards
  type ActivityData,
  type ActivityType,
  isTapAnswerData,
  isCountObjectsData,
  isMatchData,
  isSequenceData,
  isIdentifyColorData,
  isIdentifyShapeData,
  isMultipleChoiceData,
  isTrueFalseData,
  // Validation
  validateActivityData,
  validateAnswer,
  type ValidationResult,
  // Test fixtures
  activityTestFixtures,
} from "../src/lib/activity/domain.ts";
import {
  renderActivity,
  validateActivityAnswer,
} from "../src/lib/activity/renderer.ts";
import type { ActivityRenderInput } from "../src/lib/activity/domain.ts";

const FIXTURE_TYPES: ActivityType[] = [
  "TAP_ANSWER",
  "COUNT_OBJECTS",
  "MATCH",
  "SEQUENCE",
  "IDENTIFY_COLOR",
  "IDENTIFY_SHAPE",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
];

describe("Phase 6 — Activity Engine", () => {
  // ---------------------------------------------------------
  // 6.1 Domain contract — type guards & fixtures exist
  // ---------------------------------------------------------
  describe("6.1 Domain contract & type guards", () => {
    it("activityTestFixtures has entry for every MVP activity type", () => {
      for (const type of FIXTURE_TYPES) {
        assert.ok(type in activityTestFixtures, `fixture missing for ${type}`);
      }
    });

    it("type guards correctly narrow ActivityData union", () => {
      const tap = activityTestFixtures.TAP_ANSWER;
      assert.ok(isTapAnswerData(tap));
      assert.ok(!isCountObjectsData(tap));

      const count = activityTestFixtures.COUNT_OBJECTS;
      assert.ok(isCountObjectsData(count));
      assert.ok(!isTapAnswerData(count));

      const match = activityTestFixtures.MATCH;
      assert.ok(isMatchData(match));

      const seq = activityTestFixtures.SEQUENCE;
      assert.ok(isSequenceData(seq));

      const color = activityTestFixtures.IDENTIFY_COLOR;
      assert.ok(isIdentifyColorData(color));

      const shape = activityTestFixtures.IDENTIFY_SHAPE;
      assert.ok(isIdentifyShapeData(shape));

      const mc = activityTestFixtures.MULTIPLE_CHOICE;
      assert.ok(isMultipleChoiceData(mc));

      const tf = activityTestFixtures.TRUE_FALSE;
      assert.ok(isTrueFalseData(tf));
    });

    it("fixtures have valid structure per type", () => {
      // TAP_ANSWER: items array, exactly one isCorrect
      const tap = activityTestFixtures.TAP_ANSWER;
      assert.ok(isTapAnswerData(tap));
      assert.ok(Array.isArray(tap.items));
      assert.ok(tap.items.length >= 2);
      assert.equal(tap.items.filter((i) => i.isCorrect).length, 1);

      // COUNT_OBJECTS: objects array, correctAnswer number
      const count = activityTestFixtures.COUNT_OBJECTS;
      assert.ok(isCountObjectsData(count));
      assert.ok(Array.isArray(count.objects));
      assert.ok(typeof count.correctAnswer === "number");

      // MATCH: left/right arrays, correctPairs object
      const match = activityTestFixtures.MATCH;
      assert.ok(isMatchData(match));
      assert.ok(Array.isArray(match.left));
      assert.ok(Array.isArray(match.right));
      assert.ok(typeof match.correctPairs === "object");

      // SEQUENCE: items with correctPosition 0..n-1
      const seq = activityTestFixtures.SEQUENCE;
      assert.ok(isSequenceData(seq));
      assert.ok(Array.isArray(seq.items));
      const positions = seq.items.map((i) => i.correctPosition).sort((a, b) => a - b);
      for (let i = 0; i < positions.length; i++) {
        assert.equal(positions[i], i);
      }

      // IDENTIFY_COLOR: targetColorName, options with exactly one correct
      const color = activityTestFixtures.IDENTIFY_COLOR;
      assert.ok(isIdentifyColorData(color));
      assert.ok(typeof color.targetColorName === "string");
      assert.ok(Array.isArray(color.options));
      assert.equal(color.options.filter((o) => o.isCorrect).length, 1);

      // IDENTIFY_SHAPE: targetShapeName, options with exactly one correct
      const shape = activityTestFixtures.IDENTIFY_SHAPE;
      assert.ok(isIdentifyShapeData(shape));
      assert.ok(typeof shape.targetShapeName === "string");
      assert.ok(Array.isArray(shape.options));
      assert.equal(shape.options.filter((o) => o.isCorrect).length, 1);

      // MULTIPLE_CHOICE: question, options with at least one correct
      const mc = activityTestFixtures.MULTIPLE_CHOICE;
      assert.ok(isMultipleChoiceData(mc));
      assert.ok(typeof mc.question === "string");
      assert.ok(Array.isArray(mc.options));
      assert.ok(mc.options.filter((o) => o.isCorrect).length >= 1);

      // TRUE_FALSE: statement, correctAnswer boolean
      const tf = activityTestFixtures.TRUE_FALSE;
      assert.ok(isTrueFalseData(tf));
      assert.ok(typeof tf.statement === "string");
      assert.ok(typeof tf.correctAnswer === "boolean");
    });
  });

  // ---------------------------------------------------------
  // 6.9 Server-side answer validation (validateAnswer)
  // ---------------------------------------------------------
  describe("6.9 Server-side answer validation", () => {
    it("TAP_ANSWER: correct id returns isCorrect=true", () => {
      const data = activityTestFixtures.TAP_ANSWER;
      assert.ok(isTapAnswerData(data));
      const correctId = data.items.find((i) => i.isCorrect)!.id;
      const result = validateAnswer("TAP_ANSWER", data, { id: correctId });
      assert.equal(result.isCorrect, true);
      assert.ok(result.explanation?.includes("Tepat"));
    });

    it("TAP_ANSWER: wrong id returns isCorrect=false with hint", () => {
      const data = activityTestFixtures.TAP_ANSWER;
      assert.ok(isTapAnswerData(data));
      const wrongId = data.items.find((i) => !i.isCorrect)!.id;
      const result = validateAnswer("TAP_ANSWER", data, { id: wrongId });
      assert.equal(result.isCorrect, false);
      assert.ok(result.hint);
    });

    it("COUNT_OBJECTS: exact count returns correct", () => {
      const data = activityTestFixtures.COUNT_OBJECTS;
      assert.ok(isCountObjectsData(data));
      const result = validateAnswer("COUNT_OBJECTS", data, { count: data.correctAnswer });
      assert.equal(result.isCorrect, true);
    });

    it("COUNT_OBJECTS: wrong count returns incorrect with hint", () => {
      const data = activityTestFixtures.COUNT_OBJECTS;
      assert.ok(isCountObjectsData(data));
      const result = validateAnswer("COUNT_OBJECTS", data, { count: data.correctAnswer + 1 });
      assert.equal(result.isCorrect, false);
      assert.ok(result.hint?.includes("perlahan"));
    });

    it("MATCH: all correct pairs returns correct", () => {
      const data = activityTestFixtures.MATCH;
      assert.ok(isMatchData(data));
      const result = validateAnswer("MATCH", data, data.correctPairs);
      assert.equal(result.isCorrect, true);
    });

    it("MATCH: missing/incorrect pair returns incorrect", () => {
      const data = activityTestFixtures.MATCH;
      assert.ok(isMatchData(data));
      const wrongPairs = { ...data.correctPairs };
      const firstKey = Object.keys(wrongPairs)[0];
      wrongPairs[firstKey] = "wrong-id";
      const result = validateAnswer("MATCH", data, wrongPairs);
      assert.equal(result.isCorrect, false);
    });

    it("SEQUENCE: correct order returns correct", () => {
      const data = activityTestFixtures.SEQUENCE;
      assert.ok(isSequenceData(data));
      const correctOrder = data.items.map((i) => i.id);
      const result = validateAnswer("SEQUENCE", data, correctOrder);
      assert.equal(result.isCorrect, true);
    });

    it("SEQUENCE: wrong order returns incorrect", () => {
      const data = activityTestFixtures.SEQUENCE;
      assert.ok(isSequenceData(data));
      const wrongOrder = [...data.items.map((i) => i.id)].reverse();
      const result = validateAnswer("SEQUENCE", data, wrongOrder);
      assert.equal(result.isCorrect, false);
    });

    it("IDENTIFY_COLOR: correct color id returns correct", () => {
      const data = activityTestFixtures.IDENTIFY_COLOR;
      assert.ok(isIdentifyColorData(data));
      const correctId = data.options.find((o) => o.isCorrect)!.id;
      const result = validateAnswer("IDENTIFY_COLOR", data, { id: correctId });
      assert.equal(result.isCorrect, true);
      assert.ok(result.explanation?.includes(data.targetColorName));
    });

    it("IDENTIFY_SHAPE: correct shape id returns correct", () => {
      const data = activityTestFixtures.IDENTIFY_SHAPE;
      assert.ok(isIdentifyShapeData(data));
      const correctId = data.options.find((o) => o.isCorrect)!.id;
      const result = validateAnswer("IDENTIFY_SHAPE", data, { id: correctId });
      assert.equal(result.isCorrect, true);
      assert.ok(result.explanation?.includes(data.targetShapeName));
    });

    it("MULTIPLE_CHOICE: single correct option returns correct", () => {
      const data = activityTestFixtures.MULTIPLE_CHOICE;
      assert.ok(isMultipleChoiceData(data));
      const correctIds = data.options.filter((o) => o.isCorrect).map((o) => o.id);
      const result = validateAnswer("MULTIPLE_CHOICE", data, { ids: correctIds });
      assert.equal(result.isCorrect, true);
    });

    it("MULTIPLE_CHOICE: wrong option returns incorrect", () => {
      const data = activityTestFixtures.MULTIPLE_CHOICE;
      assert.ok(isMultipleChoiceData(data));
      const wrongId = data.options.find((o) => !o.isCorrect)!.id;
      const result = validateAnswer("MULTIPLE_CHOICE", data, { id: wrongId });
      assert.equal(result.isCorrect, false);
    });

    it("TRUE_FALSE: correct boolean returns correct", () => {
      const data = activityTestFixtures.TRUE_FALSE;
      assert.ok(isTrueFalseData(data));
      const result = validateAnswer("TRUE_FALSE", data, { value: data.correctAnswer });
      assert.equal(result.isCorrect, true);
    });

    it("TRUE_FALSE: wrong boolean returns incorrect", () => {
      const data = activityTestFixtures.TRUE_FALSE;
      assert.ok(isTrueFalseData(data));
      const result = validateAnswer("TRUE_FALSE", data, { value: !data.correctAnswer });
      assert.equal(result.isCorrect, false);
    });

    it("unknown activity type throws", () => {
      assert.throws(
        () => validateAnswer("UNKNOWN_TYPE" as ActivityType, activityTestFixtures.TAP_ANSWER, {}),
        /Unknown activity type/,
      );
    });
  });

  // ---------------------------------------------------------
  // 6.13 Type-driven renderer — renderActivity covers all types
  // ---------------------------------------------------------
  describe("6.13 Type-driven renderer", () => {
    function makeInput(type: ActivityType): ActivityRenderInput {
      return {
        activityId: "test-activity-id",
        type,
        prompt: "Test prompt",
        data: activityTestFixtures[type],
        childAge: 5,
        audioEnabled: false,
        reducedMotion: false,
      };
    }

    it("renders every activity type without throwing", () => {
      for (const type of FIXTURE_TYPES) {
        const html = renderActivity(makeInput(type));
        assert.ok(typeof html === "string");
        assert.ok(html.length > 0);
        assert.ok(html.includes("activity-root"));
        assert.ok(html.includes("activity-prompt"));
        assert.ok(html.includes("activity-interaction"));
        assert.ok(html.includes("activity-feedback"));
      }
    });

    it("renders Tap Answer with option buttons and client init script", () => {
      const html = renderActivity(makeInput("TAP_ANSWER"));
      assert.ok(html.includes("tap-answer-grid"));
      assert.ok(html.includes("option-btn"));
      assert.ok(html.includes("initTapAnswer"));
    });

    it("renders Count Objects with number input and submit", () => {
      const html = renderActivity(makeInput("COUNT_OBJECTS"));
      assert.ok(html.includes("count-objects-area"));
      assert.ok(html.includes('type="number"'));
      assert.ok(html.includes("initCountObjects"));
    });

    it("renders Match with drag/drop columns and submit", () => {
      const html = renderActivity(makeInput("MATCH"));
      assert.ok(html.includes("match-area"));
      assert.ok(html.includes("draggable=\"true\""));
      assert.ok(html.includes("initMatch"));
    });

    it("renders Sequence with draggable items", () => {
      const html = renderActivity(makeInput("SEQUENCE"));
      assert.ok(html.includes("sequence-area"));
      assert.ok(html.includes("draggable=\"true\""));
      assert.ok(html.includes("initSequence"));
    });

    it("renders Identify Color with color swatches", () => {
      const html = renderActivity(makeInput("IDENTIFY_COLOR"));
      assert.ok(html.includes("identify-color-area"));
      assert.ok(html.includes("color-swatch"));
      assert.ok(html.includes("initIdentifyColor"));
    });

    it("renders Identify Shape with shape icons", () => {
      const html = renderActivity(makeInput("IDENTIFY_SHAPE"));
      assert.ok(html.includes("identify-shape-area"));
      assert.ok(html.includes("shape-icon"));
      assert.ok(html.includes("initIdentifyShape"));
    });

    it("renders Multiple Choice with question and options", () => {
      const html = renderActivity(makeInput("MULTIPLE_CHOICE"));
      assert.ok(html.includes("multiple-choice-area"));
      assert.ok(html.includes("mc-question"));
      assert.ok(html.includes("initMultipleChoice"));
    });

    it("renders True/False with two options", () => {
      const html = renderActivity(makeInput("TRUE_FALSE"));
      assert.ok(html.includes("true-false-area"));
      assert.ok(html.includes("tf-statement"));
      assert.ok(html.includes("initTrueFalse"));
    });

    it("unknown type returns error state without crashing", () => {
      const input = makeInput("TAP_ANSWER");
      input.type = "UNKNOWN_TYPE" as ActivityType;
      const html = renderActivity(input);
      assert.ok(html.includes("activity-error"));
      assert.ok(html.includes("belum didukung"));
      assert.ok(html.includes("Kembali ke Beranda"));
    });

    it("base layout includes progress ring, prompt, feedback, home button", () => {
      const html = renderActivity(makeInput("TAP_ANSWER"));
      assert.ok(html.includes("progress-ring"));
      assert.ok(html.includes("progress-fill"));
      assert.ok(html.includes("prompt-text"));
      assert.ok(html.includes("feedback-content"));
      assert.ok(html.includes("btn-retry"));
      assert.ok(html.includes("btn-next"));
      assert.ok(html.includes("btn-home"));
      assert.ok(html.includes("Beranda"));
    });

    it("uses DESIGN.md tokens (no hardcoded hex colors)", () => {
      const html = renderActivity(makeInput("TAP_ANSWER"));
      // Should use CSS variables, not hardcoded hex
      assert.ok(!/#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})/.test(html), "no hardcoded hex colors in rendered HTML");
      assert.ok(html.includes("var(--c-"));
    });
  });

  // ---------------------------------------------------------
  // 6.14 Invalid payloads fail safely (validateActivityData)
  // ---------------------------------------------------------
  describe("6.14 Invalid payloads fail safely", () => {
    it("TAP_ANSWER: missing items throws", () => {
      assert.throws(
        () => validateActivityData("TAP_ANSWER", { type: "tap_answer" }),
        /items array required/,
      );
    });

    it("TAP_ANSWER: items < 2 throws", () => {
      assert.throws(
        () =>
          validateActivityData("TAP_ANSWER", {
            type: "tap_answer",
            items: [{ id: "a", label: "A", isCorrect: true }],
          }),
        /min 2/,
      );
    });

    it("TAP_ANSWER: zero correct throws", () => {
      assert.throws(
        () =>
          validateActivityData("TAP_ANSWER", {
            type: "tap_answer",
            items: [
              { id: "a", label: "A", isCorrect: false },
              { id: "b", label: "B", isCorrect: false },
            ],
          }),
        /exactly one item must have isCorrect=true/,
      );
    });

    it("TAP_ANSWER: multiple correct throws", () => {
      assert.throws(
        () =>
          validateActivityData("TAP_ANSWER", {
            type: "tap_answer",
            items: [
              { id: "a", label: "A", isCorrect: true },
              { id: "b", label: "B", isCorrect: true },
            ],
          }),
        /exactly one item must have isCorrect=true/,
      );
    });

    it("COUNT_OBJECTS: missing objects throws", () => {
      assert.throws(
        () =>
          validateActivityData("COUNT_OBJECTS", {
            type: "count_objects",
            correctAnswer: 5,
          }),
        /objects array required/,
      );
    });

    it("COUNT_OBJECTS: negative correctAnswer throws", () => {
      assert.throws(
        () =>
          validateActivityData("COUNT_OBJECTS", {
            type: "count_objects",
            objects: [{ id: "o1", visualKey: "star", count: 1 }],
            correctAnswer: -1,
          }),
        /non-negative/,
      );
    });

    it("MATCH: missing left/right throws", () => {
      assert.throws(
        () =>
          validateActivityData("MATCH", {
            type: "match",
            correctPairs: {},
          }),
        /left array required/,
      );
    });

    it("MATCH: unknown leftId in correctPairs throws", () => {
      assert.throws(
        () =>
          validateActivityData("MATCH", {
            type: "match",
            left: [{ id: "l1", label: "A" }],
            right: [{ id: "r1", label: "B" }],
            correctPairs: { l99: "r1" },
          }),
        /unknown leftId/,
      );
    });

    it("SEQUENCE: gaps in correctPosition throws", () => {
      assert.throws(
        () =>
          validateActivityData("SEQUENCE", {
            type: "sequence",
            items: [
              { id: "s1", label: "1", correctPosition: 0 },
              { id: "s2", label: "2", correctPosition: 2 }, // gap
            ],
          }),
        /without gaps/,
      );
    });

    it("IDENTIFY_COLOR: zero correct throws", () => {
      assert.throws(
        () =>
          validateActivityData("IDENTIFY_COLOR", {
            type: "identify_color",
            targetColorName: "merah",
            options: [
              { id: "c1", colorValue: "#FF0000", colorName: "merah", isCorrect: false },
              { id: "c2", colorValue: "#0000FF", colorName: "biru", isCorrect: false },
            ],
          }),
        /exactly one option must have isCorrect=true/,
      );
    });

    it("MULTIPLE_CHOICE: zero correct throws", () => {
      assert.throws(
        () =>
          validateActivityData("MULTIPLE_CHOICE", {
            type: "multiple_choice",
            question: "Test?",
            options: [
              { id: "m1", label: "A", isCorrect: false },
              { id: "m2", label: "B", isCorrect: false },
            ],
          }),
        /at least one option must have isCorrect=true/,
      );
    });

    it("TRUE_FALSE: missing statement throws", () => {
      assert.throws(
        () =>
          validateActivityData("TRUE_FALSE", {
            type: "true_false",
            correctAnswer: true,
          }),
        /statement required/,
      );
    });

    it("malformed payload (not object) throws", () => {
      assert.throws(
        () => validateActivityData("TAP_ANSWER", "not an object"),
        /not an object/,
      );
    });

    it("type mismatch throws", () => {
      assert.throws(
        () =>
          validateActivityData("TAP_ANSWER", {
            type: "count_objects",
            items: [{ id: "a", label: "A", isCorrect: true }],
          }),
        /type mismatch/,
      );
    });
  });

  // ---------------------------------------------------------
  // 6.9/6.13 validateActivityAnswer wrapper (renderer export)
  // ---------------------------------------------------------
  describe("6.9/6.13 validateActivityAnswer wrapper (renderer export)", () => {
      it("delegates to validateAnswer", () => {
        const data = activityTestFixtures.TAP_ANSWER;
        assert.ok(isTapAnswerData(data));
        const correctId = data.items.find((i) => i.isCorrect)!.id;
        const result = validateActivityAnswer("TAP_ANSWER", data, { id: correctId });
        assert.equal(result.isCorrect, true);
      });
    });

  // ---------------------------------------------------------
  // 6.10 Retry & 6.11 Completion & 6.12 Feedback — structural
  // (UI interaction tested in Phase 7 E2E; here verify renderer has hooks)
  // ---------------------------------------------------------
  describe("6.10–6.12 Retry, completion, feedback hooks in renderer", () => {
    it("base layout has retry button (hidden initially)", () => {
      const html = renderActivity({
        activityId: "x",
        type: "TAP_ANSWER",
        prompt: "p",
        data: activityTestFixtures.TAP_ANSWER,
        childAge: 5,
        audioEnabled: false,
        reducedMotion: false,
      });
      assert.ok(html.includes("btn-retry"));
      assert.ok(html.includes("hidden"));
    });

    it("base layout has next activity button (hidden initially)", () => {
      const html = renderActivity({
        activityId: "x",
        type: "TAP_ANSWER",
        prompt: "p",
        data: activityTestFixtures.TAP_ANSWER,
        childAge: 5,
        audioEnabled: false,
        reducedMotion: false,
      });
      assert.ok(html.includes("btn-next"));
      assert.ok(html.includes("Aktivitas Berikutnya"));
    });

    it("feedback region has aria-live for screen readers", () => {
      const html = renderActivity({
        activityId: "x",
        type: "TAP_ANSWER",
        prompt: "p",
        data: activityTestFixtures.TAP_ANSWER,
        childAge: 5,
        audioEnabled: false,
        reducedMotion: false,
      });
      assert.ok(html.includes('aria-live="polite"'));
    });
  });
});