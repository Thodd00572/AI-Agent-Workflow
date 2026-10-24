import { openDb, type AppDb } from "./schema.ts";
import { listAudit, listPublications, listRevisions, listSignals, listTargets, seedDefaults, stats } from "./repo.ts";

export function openAndReady(databaseUrl: string): { db: AppDb } {
  const { db } = openDb(databaseUrl);
  seedDefaults(db);
  return { db };
}

export { listAudit, listPublications, listRevisions, listSignals, listTargets, stats };
