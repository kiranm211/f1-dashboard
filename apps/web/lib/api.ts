export type SessionItem = {
  sessionKey: number;
  sessionName: string;
  sessionType: string;
  currentState: "scheduled" | "warmup" | "live" | "cooldown" | "closed";
  dateStart: string;
  dateEnd: string;
  countryName: string;
  location: string | null;
  circuitShortName: string | null;
  meetingKey: number;
  meetingName: string;
  updatedAt: string;
};

export type LeaderboardItem = {
  sessionKey: number;
  driverNumber: number;
  position: number;
  date: string | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  teamColour: string | null;
  interval: number | null;
  gapToLeader: string | null;
};

export type ApiMeta = {
  freshness: {
    generatedAt: string;
    lastSyncAt: string | null;
    stalenessMs: number | null;
  };
};

export type HealthResponse = {
  status: string;
  service: string;
};

type SessionsQuery = {
  year?: number;
  state?: SessionItem["currentState"];
  limit?: number;
};

export async function fetchHealth(): Promise<HealthResponse> {
  const response = await fetch("/health");
  if (!response.ok) {
    throw new Error(`Failed to fetch health (${response.status})`);
  }
  return response.json();
}

export async function fetchSessions(query: SessionsQuery = {}): Promise<{ items: SessionItem[]; meta: ApiMeta }> {
  const params = new URLSearchParams();
  params.set("limit", String(query.limit ?? 40));
  if (query.year) {
    params.set("year", String(query.year));
  }
  if (query.state) {
    params.set("state", query.state);
  }

  const response = await fetch(`/v1/sessions?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions (${response.status})`);
  }
  return response.json();
}

export async function fetchLeaderboard(sessionKey: number): Promise<{ items: LeaderboardItem[]; meta: ApiMeta }> {
  const response = await fetch(`/v1/leaderboard?sessionKey=${sessionKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch leaderboard (${response.status})`);
  }
  return response.json();
}
