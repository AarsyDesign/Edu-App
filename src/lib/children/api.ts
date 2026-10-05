/**
 * Pembantu endpoint profil anak (VRD Phase 4).
 *
 * - `parentIdOf()` hanya membaca sesi yang sudah divalidasi middleware
 *   (`locals.parentSession`); tidak pernah body/kueri/parameter klien
 *   (VRD 3.8). Bila sesi tidak ada di konteks → 401, bukan fallback lain.
 * - `publicChild()` adalah satu-satunya bentuk profil anak yang boleh keluar
 *   ke klien: tanpa `parentAccountId`, tanpa kolom apa pun di luar skema
 *   minimisasi (PRD §8, §14).
 */
import type { APIContext } from "astro";
import { errorResponse } from "../auth/http.ts";
import type { ChildErrorCode, ChildProfile } from "./profiles.ts";
import { childSafeMessage } from "./profiles.ts";

/** Ambil pemilik dari sesi middleware; `Response` 401 bila sesi tidak ada. */
export function parentIdOf(context: APIContext): string | Response {
  const parentId = context.locals.parentSession?.parentId;
  if (typeof parentId !== "string" || parentId.length === 0) {
    return errorResponse(
      401,
      "UNAUTHENTICATED",
      "Silakan masuk ke akun orang tua terlebih dahulu.",
    );
  }
  return parentId;
}

/** Status HTTP per kode galat profil anak (konsisten di semua endpoint). */
export function childErrorStatus(code: ChildErrorCode): number {
  switch (code) {
    case "INVALID_INPUT":
      return 400;
    case "NICKNAME_TAKEN":
      return 409;
    case "NOT_FOUND":
      return 404;
  }
}

/** Respons galat standar untuk hasil `Result` profil anak. */
export function childErrorResponse(code: ChildErrorCode): Response {
  return errorResponse(childErrorStatus(code), code, childSafeMessage(code));
}

export interface PublicChild {
  childId: string;
  nickname: string;
  age: number;
  avatarKey: string | null;
  language: string;
  learningGoals: string[];
  archivedAt: Date | null;
  createdAt: Date;
}

/** Bentuk profil anak untuk klien — tanpa `parentAccountId` (VRD 3.8). */
export function publicChild(child: ChildProfile): PublicChild {
  return {
    childId: child.childId,
    nickname: child.nickname,
    age: child.age,
    avatarKey: child.avatarKey,
    language: child.language,
    learningGoals: [...child.learningGoals],
    archivedAt: child.archivedAt,
    createdAt: child.createdAt,
  };
}
