/**
 * QA E2E eksploratif 6 tipe aktivitas (VRD 16.10–16.13 + 17.1/17.13) —
 * gerbang regresi untuk empat temuan peramban run ini:
 *
 * F1 — COUNT_OBJECTS hanya menggambar satu titik per kelompok, jadi anak
 *      diminta menghitung lima bintang tetapi layar menampilkan dua.
 * F2 — `visualKey` konten disuntik tanpa batas pola ke markup layar anak
 *      (kelas CSS), padahal semua elemen lain di perender di-escape.
 * F3 — urutan tampil SEQUENCE selalu sama dengan urutan benar (editor
 *      menurunkan `correctPosition` dari urutan baris), sehingga aktivitas
 *      bisa "benar" dengan mengetuk dari atas ke bawah.
 * F4 — status dipilih/terpasang di MATCH hanya lewat warna.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  activityTestFixtures,
  validateActivityData,
  validateAnswer,
  COUNT_MAX_PER_GROUP,
  type ActivityRenderInput,
  type ActivityType,
} from "../src/lib/activity/domain.ts";
import { renderActivity, sequenceDisplayOrder } from "../src/lib/activity/renderer.ts";
import {
  buildActivityPayload,
  validateActivityPayload,
} from "../src/lib/activity/editor-payload.ts";

function makeInput(type: ActivityType): ActivityRenderInput {
  return {
    activityId: "qa-activity-types-id",
    type,
    prompt: "Pertanyaan uji",
    data: activityTestFixtures[type],
    childAge: 5,
    audioEnabled: false,
    reducedMotion: false,
  };
}

describe("QA tipe aktivitas — gerbang regresi", () => {
  describe("F1: COUNT_OBJECTS menggambar count titik per kelompok", () => {
    it("jumlah titik di layar = jumlah semua count = correctAnswer", () => {
      const html = renderActivity(makeInput("COUNT_OBJECTS"));
      const data = activityTestFixtures.COUNT_OBJECTS as {
        objects: Array<{ count: number }>;
        correctAnswer: number;
      };
      const dots = html.match(/class="visual-[^"]*"/g) ?? [];
      assert.equal(dots.length, data.correctAnswer);
      assert.equal(
        data.objects.reduce((sum, o) => sum + o.count, 0),
        data.correctAnswer,
      );
      // data-count ikut mencerminkan jumlah yang digambar
      const drawn = [...html.matchAll(/data-count="(\d+)"/g)].map((m) => Number(m[1]));
      assert.deepEqual(drawn, data.objects.map((o) => o.count));
    });

    it("kelompok count 0 menggambar nol titik, bukan satu", () => {
      const html = renderActivity({
        ...makeInput("COUNT_OBJECTS"),
        data: {
          type: "count_objects",
          objects: [
            { id: "o1", visualKey: "star", count: 0 },
            { id: "o2", visualKey: "star", count: 4 },
          ],
          correctAnswer: 4,
        },
      });
      const dots = html.match(/class="visual-[^"]*"/g) ?? [];
      assert.equal(dots.length, 4);
    });
  });

  describe("F2: visualKey konten tidak pernah menulis markup bebas", () => {
    it("validator menolak visualKey di luar pola kunci", () => {
      for (const bad of ['bintang", onload="x', 'x"><script>', "Stär", "a b"]) {
        assert.throws(
          () =>
            validateActivityData("COUNT_OBJECTS", {
              type: "count_objects",
              objects: [{ id: "o1", visualKey: bad, count: 3 }],
              correctAnswer: 3,
            }),
          /visualKey/,
          `harus menolak visualKey: ${bad}`,
        );
      }
    });

    it("validator menolak count non-bulat dan di atas pagar render", () => {
      assert.throws(
        () =>
          validateActivityData("COUNT_OBJECTS", {
            type: "count_objects",
            objects: [{ id: "o1", visualKey: "star", count: 2.5 }],
            correctAnswer: 2.5,
          }),
        /count must be an integer/,
      );
      assert.throws(
        () =>
          validateActivityData("COUNT_OBJECTS", {
            type: "count_objects",
            objects: [
              { id: "o1", visualKey: "star", count: COUNT_MAX_PER_GROUP + 1 },
            ],
            correctAnswer: COUNT_MAX_PER_GROUP + 1,
          }),
        /count must be an integer/,
      );
      // pagar tetap menerima batas atas
      const ok = validateActivityData("COUNT_OBJECTS", {
        type: "count_objects",
        objects: [{ id: "o1", visualKey: "star", count: COUNT_MAX_PER_GROUP }],
        correctAnswer: COUNT_MAX_PER_GROUP,
      });
      assert.equal(ok.type, "count_objects");
    });

    it("perender tetap aman walau data tidak lewat validator", () => {
      const html = renderActivity({
        ...makeInput("COUNT_OBJECTS"),
        data: {
          type: "count_objects",
          objects: [{ id: "o1", visualKey: 'x"><img src=x>', count: 3 }],
          correctAnswer: 3,
        },
      });
      assert.ok(!html.includes('x"><img'), "kunci liar tidak boleh masuk markup");
      assert.equal((html.match(/class="visual"/g) ?? []).length, 3);
    });

    it("pesan editor menolak kunci visual & jumlah di luar pola", () => {
      const common = {
        prompt: "Ada berapa?",
        learningAreaId: "11111111-1111-1111-1111-111111111111",
        skillId: "22222222-2222-2222-2222-222222222222",
        targetAgeMin: 3,
        targetAgeMax: 7,
        difficulty: 1,
        explanation: null,
        contentOrigin: "HUMAN_CREATED",
        sources: [],
      };
      const badKey = buildActivityPayload({
        common: { ...common, interactionType: "COUNT_OBJECTS" },
        rows: [{ visualKey: "Bintang!", count: "3" }],
        trueFalse: null,
      });
      assert.match(String(validateActivityPayload(badKey)), /Kunci visual/);

      const tooMany = buildActivityPayload({
        common: { ...common, interactionType: "COUNT_OBJECTS" },
        rows: [{ visualKey: "star", count: String(COUNT_MAX_PER_GROUP + 1) }],
        trueFalse: null,
      });
      assert.match(String(validateActivityPayload(tooMany)), /maksimal/);
    });
  });

  describe("F3: urutan tampil SEQUENCE bukan urutan jawaban", () => {
    const items = (activityTestFixtures.SEQUENCE as {
      items: Array<{ id: string; correctPosition: number }>;
    }).items;

    it("tidak pernah menampilkan urutan benar, untuk id aktivitas apa pun", () => {
      for (let i = 0; i < 50; i += 1) {
        const display = sequenceDisplayOrder(items, `activity-${i}`);
        assert.ok(
          !display.every((item, index) => item.correctPosition === index),
          `urutan tampil benar pada activity-${i}`,
        );
        assert.deepEqual(
          [...display].sort((a, b) => a.correctPosition - b.correctPosition).map((x) => x.id),
          items.map((x) => x.id),
          "semua item tetap ada",
        );
      }
    });

    it("deterministik per aktivitas dan tidak mengubah masukan", () => {
      const before = items.map((i) => i.id);
      const a = sequenceDisplayOrder(items, "act-fixed");
      const b = sequenceDisplayOrder(items, "act-fixed");
      assert.deepEqual(a.map((x) => x.id), b.map((x) => x.id));
      assert.deepEqual(items.map((i) => i.id), before);
    });

    it("markup perender memakai urutan tampil, penilaian tetap correctPosition", () => {
      const html = renderActivity(makeInput("SEQUENCE"));
      const shown = [...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1]);
      const correctIds = items
        .slice()
        .sort((a, b) => a.correctPosition - b.correctPosition)
        .map((x) => x.id);
      assert.deepEqual(shown, sequenceDisplayOrder(items, "qa-activity-types-id").map((x) => x.id));
      assert.notDeepEqual(shown, correctIds);
      // mengetuk urutan tampil (atas ke bawah) tidak otomatis benar
      const naive = validateAnswer("SEQUENCE", activityTestFixtures.SEQUENCE, shown);
      assert.equal(naive.isCorrect, false);
      // jawaban benar tetap diterima server
      const right = validateAnswer("SEQUENCE", activityTestFixtures.SEQUENCE, correctIds);
      assert.equal(right.isCorrect, true);
    });
  });

  describe("F4: status MATCH tidak disampaikan lewat warna saja", () => {
    const css = readFileSync(path.join(process.cwd(), "src/styles/activity.css"), "utf8");

    it("item terpilih & terpasang punya penanda teks sendiri", () => {
      assert.match(css, /\.match-item\[data-selected="true"\]::after\s*\{\s*content:/);
      assert.match(css, /\.match-item\[data-paired="true"\]::after\s*\{\s*content:/);
      assert.match(css, /✓ dipilih/);
      assert.match(css, /✓ terpasang/);
    });

    it("kelompok titik membungkus agar tidak overflow di layar sempit", () => {
      assert.match(css, /\.count-object\s*\{[^}]*flex-wrap:\s*wrap/s);
    });
  });
});
