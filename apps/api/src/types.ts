export type ApiMeta = {
  cache: {
    hit: boolean;
    key: string;
    ttlSeconds: number;
  };
  freshness: {
    generatedAt: string;
    lastSyncAt: string | null;
    stalenessMs: number | null;
  };
};
