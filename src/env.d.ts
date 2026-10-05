/**
 * Tipe global aplikasi. `App.Locals` diisi middleware (src/middleware.ts)
 * berisi sesi orang tua yang sudah divalidasi terhadap database.
 */
declare namespace App {
  interface Locals {
    parentSession?: {
      parentId: string;
      sessionId: string;
      expiresAt: Date;
    };
  }
}
