/**
 * Tipe global aplikasi. `App.Locals` diisi middleware (src/middleware.ts)
 * berisi sesi orang tua yang sudah divalidasi terhadap database.
 * `reviewerSession` diisi oleh middleware reviewer (src/lib/auth/reviewer-guard.ts).
 */
declare namespace App {
  interface Locals {
    parentSession?: {
      parentId: string;
      sessionId: string;
      expiresAt: Date;
    };
    reviewerSession?: {
      reviewerId: string;
      expiresAt: Date;
    };
  }
}
