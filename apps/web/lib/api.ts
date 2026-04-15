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

export type RaceCalendarSessionItem = {
  sessionKey: number;
  sessionName: string;
  sessionType: string;
  currentState: SessionItem["currentState"];
  dataReady: boolean;
  dateStart: string;
  dateEnd: string;
};

export type RaceCalendarWeekendItem = {
  meetingKey: number;
  meetingName: string;
  countryName: string;
  location: string | null;
  circuitShortName: string | null;
  dateStart: string;
  dateEnd: string;
  sessions: RaceCalendarSessionItem[];
};

export type RaceCalendarMonthBucket = {
  month: number;
  monthLabel: string;
  weekends: RaceCalendarWeekendItem[];
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

export type AdminSyncOverview = {
  summary: {
    trackedSessions: number;
    liveSessions: number;
    pausedSessions: number;
    pendingBootstrapSessions: number;
    remainingBootstrapEndpoints: number;
    jobs: {
      total: number;
      enabled: number;
      running: number;
      failed: number;
      dueNow: number;
      dueSoon: number;
    };
    ingestion24h: {
      byStatus: Array<{
        status: string;
        batches: number;
        rowsIngested: number;
        lastCompletedAt: string | null;
      }>;
      totalBatches: number;
      totalRowsIngested: number;
    };
  };
  allSessions: Array<{
    sessionKey: number;
    meetingName: string;
    sessionName: string;
    sessionType: string;
    currentState: "scheduled" | "warmup" | "live" | "cooldown" | "closed";
    dateStart: string;
    dateEnd: string;
    tracked: boolean;
    paused: boolean;
    bootstrapCompleted: boolean;
    manualSync: {
      totalJobs: number;
      runningJobs: number;
      failedJobs: number;
      pendingJobs: number;
      earliestNextRunAt: string | null;
    } | null;
  }>;
  sessions: Array<{
    sessionKey: number;
    meetingName: string;
    sessionName: string;
    sessionType: string;
    currentState: "scheduled" | "warmup" | "live" | "cooldown" | "closed";
    dateStart: string;
    dateEnd: string;
    windows: {
      warmupStartsAt: string;
      liveStartsAt: string;
      cooldownStartsAt: string;
      closedAt: string;
    };
    paused: boolean;
    enabledEndpoints: string[];
    cadenceOverrides: Record<string, number>;
    bootstrapCompleted: boolean;
    bootstrapCompletedAt: string | null;
    updatedAt: string;
  }>;
  liveSyncStatus: Array<{
    sessionKey: number;
    meetingName: string;
    sessionName: string;
    enabledEndpoints: string[];
    runningJobs: number;
    failedJobs: number;
    nextRunAt: string | null;
    lastFinishedAt: string | null;
  }>;
  remainingSyncs: Array<{
    sessionKey: number;
    meetingName: string;
    sessionName: string;
    sessionType: string;
    bootstrapCompleted: boolean;
    requiredCount: number;
    syncedCount: number;
    remainingCount: number;
    requiredEndpoints: string[];
    syncedEndpoints: string[];
    remainingEndpoints: string[];
  }>;
  syncPlan: Array<{
    sessionKey: number;
    meetingName: string;
    sessionName: string;
    currentState: string;
    paused: boolean;
    endpointCadence: Array<{
      endpoint: string;
      cadenceSeconds: number | null;
      nextRunAt: string | null;
      status: string;
    }>;
  }>;
  jobs: Array<{
    jobId: number;
    jobName: string;
    endpoint: string;
    sessionKey: number | null;
    cadenceSeconds: number;
    nextRunAt: string;
    enabled: boolean;
    status: string;
    lastStartedAt: string | null;
    lastFinishedAt: string | null;
    lastError: string | null;
    updatedAt: string;
  }>;
  recentRuns: Array<{
    runId: number;
    jobId: number;
    jobName: string;
    endpoint: string;
    sessionKey: number | null;
    startedAt: string;
    finishedAt: string | null;
    status: string;
    rowsWritten: number;
    errorMessage: string | null;
    batchId: number | null;
  }>;
  watermarks: Array<{
    endpoint: string;
    sessionKey: number;
    watermark: string | null;
    lastBatchId: number | null;
    updatedAt: string;
    lagMs: number | null;
  }>;
  liveWatermarks: Array<{
    endpoint: string;
    sessionKey: number;
    watermark: string | null;
    lastBatchId: number | null;
    updatedAt: string;
    lagMs: number | null;
  }>;
  recentBatches: Array<{
    batchId: number;
    endpoint: string;
    sessionKey: number | null;
    requestedAt: string;
    completedAt: string | null;
    status: string;
    itemCount: number;
    errorMessage: string | null;
  }>;
  meta: ApiMeta;
};

export type AdminRunStatusFilter = "all" | "failed" | "succeeded" | "running" | "pending" | "paused";

export type HealthResponse = {
  status: string;
  service: string;
};

export type DriverStandingItem = {
  rank: number;
  driverNumber: number;
  fullName: string;
  nameAcronym: string | null;
  teamName: string | null;
  points: number;
  wins: number;
  podiums: number;
  classifiedFinishes: number;
  racesCount: number;
};

export type TeamStandingItem = {
  rank: number;
  teamName: string;
  points: number;
  wins: number;
  podiums: number;
  driversCount: number;
};

export type ChampionshipDriverSnapshotItem = {
  driverNumber: number;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  positionCurrent: number | null;
  positionStart: number | null;
  pointsCurrent: number | null;
  pointsStart: number | null;
};

export type ChampionshipTeamSnapshotItem = {
  teamName: string;
  positionCurrent: number | null;
  positionStart: number | null;
  pointsCurrent: number | null;
  pointsStart: number | null;
};

export type DriverDirectoryItem = {
  rank: number;
  driverNumber: number;
  broadcastName: string | null;
  firstName: string | null;
  lastName: string | null;
  fullName: string;
  nameAcronym: string | null;
  teamName: string | null;
  teamColour: string | null;
  headshotUrl: string | null;
  countryCode: string | null;
  points: number;
  wins: number;
  podiums: number;
  racesCount: number;
  facts: DriverFactData;
};

export type DriverFactData = {
  nationality: string;
  dateOfBirth: string;
  placeOfBirth: string;
  debutSeason: number;
  juniorCareerHighlight: string;
  factHeadline: string;
} | null;

export type DriverRaceResult = {
  sessionKey: number;
  meetingName: string;
  sessionName: string;
  dateStart: string;
  teamName: string | null;
  position: number | null;
  points: number;
  dnf: boolean | null;
  dns: boolean | null;
  dsq: boolean | null;
};

export type CircuitFactData = {
  canonicalName: string;
  trackLengthKm: string;
  raceDistanceKm: string;
  laps: number;
  turns: number;
  firstGrandPrix: number;
  direction: string;
  drsZones: number;
  lapRecord: string;
  lapRecordHolder: string;
  lapRecordYear: number;
  overtakingHotspot: string;
  quickFact: string;
} | null;

export type CircuitItem = {
  circuitKey: number;
  circuitShortName: string;
  countryName: string;
  location: string | null;
  circuitImage: string | null;
  meetingCount: number;
  latestMeetingName: string;
  latestDateStart: string;
  facts: CircuitFactData;
};

export type CircuitSessionItem = {
  sessionKey: number;
  sessionName: string;
  sessionType: string;
  currentState: string;
  dateStart: string;
  dateEnd: string;
  meetingKey: number;
  meetingName: string;
};

export type ReplayFrameItem = {
  driverNumber: number;
  position: number;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
  interval: number | null;
  gapToLeader: string | null;
};

export type ReplayFrame = {
  timestamp: string;
  items: ReplayFrameItem[];
};

export type SessionWeatherSnapshot = {
  date: string;
  airTemperature: number | null;
  trackTemperature: number | null;
  humidity: number | null;
  rainfall: number | null;
  pressure: number | null;
  windDirection: number | null;
  windSpeed: number | null;
};

export type SessionResultEntry = {
  driverNumber: number;
  position: number | null;
  numberOfLaps: number | null;
  dnf: boolean | null;
  dns: boolean | null;
  dsq: boolean | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
};

export type SessionRaceControlEvent = {
  date: string;
  category: string;
  flag: string | null;
  scope: string | null;
  message: string;
  lapNumber: number | null;
  driverNumber: number | null;
  sector: number | null;
};

export type SessionTeamRadioEvent = {
  date: string;
  driverNumber: number;
  recordingUrl: string;
};

export type SessionPitStopEvent = {
  date: string;
  driverNumber: number;
  lapNumber: number;
  laneDuration: number | null;
  stopDuration: number | null;
};

export type SessionOvertakeEvent = {
  date: string;
  overtakingDriverNumber: number;
  overtakenDriverNumber: number;
  position: number;
};

export type SessionStartingGridEntry = {
  driverNumber: number;
  position: number | null;
  lapDuration: number | null;
  fullName: string | null;
  nameAcronym: string | null;
  teamName: string | null;
};

type SessionsQuery = {
  year?: number;
  state?: SessionItem["currentState"];
  sessionType?: string;
  limit?: number;
};

type RacesCalendarQuery = {
  year?: number;
  state?: SessionItem["currentState"];
  raceOnly?: boolean;
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
  if (query.sessionType) {
    params.set("sessionType", query.sessionType);
  }

  const response = await fetch(`/v1/sessions?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch sessions (${response.status})`);
  }
  return response.json();
}

export async function fetchSessionByKey(sessionKey: number): Promise<{ item: SessionItem | null; meta: ApiMeta }> {
  const response = await fetch(`/v1/sessions/${sessionKey}`);
  if (response.status === 404) {
    return {
      item: null,
      meta: {
        freshness: {
          generatedAt: new Date().toISOString(),
          lastSyncAt: null,
          stalenessMs: null
        }
      }
    };
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch session ${sessionKey} (${response.status})`);
  }
  return response.json();
}

export async function fetchRacesCalendar(query: RacesCalendarQuery = {}): Promise<{
  year: number;
  availableYears: number[];
  months: RaceCalendarMonthBucket[];
  meta: ApiMeta;
}> {
  const params = new URLSearchParams();
  if (query.year) {
    params.set("year", String(query.year));
  }
  if (query.state) {
    params.set("state", query.state);
  }
  params.set("raceOnly", String(query.raceOnly ?? true));

  const response = await fetch(`/v1/races/calendar?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch races calendar (${response.status})`);
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

export async function fetchStandings(year?: number): Promise<{
  year: number;
  drivers: DriverStandingItem[];
  teams: TeamStandingItem[];
  championship: {
    sessionKey: number | null;
    drivers: ChampionshipDriverSnapshotItem[];
    teams: ChampionshipTeamSnapshotItem[];
  };
  meta: ApiMeta;
}> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", String(year));
  }

  const query = params.toString();
  const response = await fetch(query ? `/v1/standings?${query}` : "/v1/standings");
  if (!response.ok) {
    throw new Error(`Failed to fetch standings (${response.status})`);
  }
  return response.json();
}

export async function fetchDrivers(year?: number): Promise<{ year: number; items: DriverDirectoryItem[]; meta: ApiMeta }> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", String(year));
  }

  const query = params.toString();
  const response = await fetch(query ? `/v1/drivers?${query}` : "/v1/drivers");
  if (!response.ok) {
    throw new Error(`Failed to fetch drivers (${response.status})`);
  }
  return response.json();
}

export async function fetchDriverProfile(driverNumber: number, year?: number): Promise<{ year: number; driverNumber: number; profile: DriverDirectoryItem | null; recentResults: DriverRaceResult[]; meta: ApiMeta }> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", String(year));
  }

  const query = params.toString();
  const response = await fetch(query ? `/v1/drivers/${driverNumber}?${query}` : `/v1/drivers/${driverNumber}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch driver profile (${response.status})`);
  }
  return response.json();
}

export async function fetchCircuits(year?: number): Promise<{ year: number; items: CircuitItem[]; meta: ApiMeta }> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", String(year));
  }

  const query = params.toString();
  const response = await fetch(query ? `/v1/circuits?${query}` : "/v1/circuits");
  if (!response.ok) {
    throw new Error(`Failed to fetch circuits (${response.status})`);
  }
  return response.json();
}

export async function fetchCircuitProfile(circuitKey: number, year?: number): Promise<{ year: number; circuit: CircuitItem | null; sessions: CircuitSessionItem[]; meta: ApiMeta }> {
  const params = new URLSearchParams();
  if (year) {
    params.set("year", String(year));
  }

  const query = params.toString();
  const response = await fetch(query ? `/v1/circuits/${circuitKey}?${query}` : `/v1/circuits/${circuitKey}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch circuit profile (${response.status})`);
  }
  return response.json();
}

export async function fetchReplay(sessionKey: number, limit = 60): Promise<{ sessionKey: number; frames: ReplayFrame[]; meta: ApiMeta }> {
  const params = new URLSearchParams();
  params.set("sessionKey", String(sessionKey));
  params.set("limit", String(limit));

  const response = await fetch(`/v1/replay?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch replay (${response.status})`);
  }
  return response.json();
}

export async function fetchSessionInsights(sessionKey: number, eventsLimit = 12): Promise<{
  sessionKey: number;
  weather: SessionWeatherSnapshot | null;
  weatherHistory: SessionWeatherSnapshot[];
  raceControl: SessionRaceControlEvent[];
  pitStops: SessionPitStopEvent[];
  teamRadio: SessionTeamRadioEvent[];
  overtakes: SessionOvertakeEvent[];
  startingGrid: SessionStartingGridEntry[];
  sessionResults: SessionResultEntry[];
  meta: ApiMeta;
}> {
  const params = new URLSearchParams();
  params.set("sessionKey", String(sessionKey));
  params.set("eventsLimit", String(eventsLimit));

  const response = await fetch(`/v1/session-insights?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch session insights (${response.status})`);
  }
  return response.json();
}

export async function fetchAdminSyncOverview(runStatus: AdminRunStatusFilter = "all"): Promise<AdminSyncOverview> {
  const params = new URLSearchParams();
  params.set("runStatus", runStatus);

  const response = await fetch(`/v1/admin/sync?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch admin sync overview (${response.status})`);
  }
  return response.json();
}

export async function retriggerFailedRun(runId: number): Promise<{ ok: boolean; runId: number; jobId: number; queuedAt: string }> {
  const response = await fetch(`/v1/admin/sync/runs/${runId}/retrigger`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to retrigger run ${runId} (${response.status})`);
  }
  return response.json();
}

export async function triggerSessionPrioritySync(sessionKey: number): Promise<{
  ok: boolean;
  sessionKey: number;
  meetingName: string;
  sessionName: string;
  endpointsQueued: string[];
  queuedAt: string;
  message: string;
}> {
  const response = await fetch(`/v1/admin/sync/sessions/${sessionKey}/trigger`, {
    method: "POST"
  });
  if (!response.ok) {
    throw new Error(`Failed to trigger session sync ${sessionKey} (${response.status})`);
  }
  return response.json();
}

export type RaceAnalysisDriver = {
  driverNumber: number;
  nameAcronym: string | null;
  fullName: string;
  teamName: string | null;
  teamColour: string | null;
};

export type RaceAnalysisLap = {
  driverNumber: number;
  lapNumber: number;
  lapDuration: number | null;
  durationSector1: number | null;
  durationSector2: number | null;
  durationSector3: number | null;
  isPitOutLap: boolean | null;
  i1Speed: number | null;
  i2Speed: number | null;
  stSpeed: number | null;
};

export type RaceAnalysisStint = {
  driverNumber: number;
  stintNumber: number;
  compound: string | null;
  lapStart: number | null;
  lapEnd: number | null;
  tyreAgeAtStart: number | null;
};

export type RaceAnalysisPitStop = {
  driverNumber: number;
  lapNumber: number;
  stopDuration: number | null;
  laneDuration: number | null;
};

export type RaceAnalysisTelemetry = {
  driverNumber: number;
  topSpeed: number | null;
  avgSpeed: number | null;
  avgThrottle: number | null;
  avgRpm: number | null;
  carSamples: number;
  locationSamples: number;
};

export async function fetchRaceAnalysis(sessionKey: number): Promise<{
  sessionKey: number;
  drivers: RaceAnalysisDriver[];
  laps: RaceAnalysisLap[];
  stints: RaceAnalysisStint[];
  pitStops: RaceAnalysisPitStop[];
  telemetry: RaceAnalysisTelemetry[];
  meta: ApiMeta;
}> {
  const params = new URLSearchParams();
  params.set("sessionKey", String(sessionKey));

  const response = await fetch(`/v1/race-analysis?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch race analysis (${response.status})`);
  }
  return response.json();
}
