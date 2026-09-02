export type RoutineSchedule =
  | { type: "once"; at: number }
  | { type: "daily"; time: string; weekdays: number[] }
  /** Every N minutes from the moment it is saved — the sub-daily cadence a
   * watch needs, which `daily` cannot express. */
  | { type: "interval"; everyMinutes: number };

export type RoutineRunOn = "maus" | "cloud";

export type RoutineRunTrigger = "schedule" | "manual" | "webhook";

export type RoutineRunStatus =
  | "queued"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "cancelled"
  | "missed";

export interface Routine {
  id: string;
  name: string;
  prompt: string;
  botId: string;
  /** Set when the routine belongs to a room: its result is delivered there
   * rather than into the MAUS's own task thread. */
  groupId?: string;
  runOn: RoutineRunOn;
  enabled: boolean;
  schedule: RoutineSchedule;
  durationMinutes: number;
  /** Reports change rather than state: each run sees the previous result and
   * answers with the delta, and a run that finds nothing is marked quiet. */
  watch?: boolean;
  nextRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface RoutineRun {
  /** Set when this run was delivered into a room rather than a task thread;
   * `threadId` is then the room's transcript. */
  groupId?: string;
  id: string;
  routineId: string;
  routineName: string;
  prompt?: string;
  durationMinutes?: number;
  watch?: boolean;
  /** A watch run that found nothing. */
  quiet?: boolean;
  botId: string;
  runOn: RoutineRunOn;
  scheduledFor: number;
  status: RoutineRunStatus;
  manual: boolean;
  triggerSource?: RoutineRunTrigger;
  webhookId?: string;
  deliveryId?: string;
  threadId?: string;
  startedAt?: number;
  finishedAt?: number;
  output?: string;
  error?: string;
  cost?: number | null;
  denials?: string[];
  createdAt: number;
  seenAt?: number;
}

export interface RoutineInput {
  name: string;
  prompt: string;
  botId: string;
  /** Deliver the work into this room instead of the MAUS's own thread. */
  groupId?: string;
  runOn?: RoutineRunOn;
  enabled?: boolean;
  schedule: RoutineSchedule;
  durationMinutes?: number;
  watch?: boolean;
}
