import { apiFetch } from "../../lib/api/client";

export type WorkerAttendanceToday = {
  id: number | null;
  factory_id: number;
  employee_id: number;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  source: string;
  status: string;
  worked_minutes_override: number;
  late_minutes: number;
  overtime_minutes: number;
  half_day_minutes: number;
  notes: string | null;
  is_active: boolean;
  worked_minutes: number;
};

export type WorkerAttendanceHistoryItem = {
  id: number;
  attendance_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  source: string;
  status: string;
  worked_minutes_override: number;
  late_minutes: number;
  overtime_minutes: number;
  half_day_minutes: number;
  notes: string | null;
  worked_minutes: number;
};

export async function getWorkerAttendanceToday(): Promise<WorkerAttendanceToday> {
  return apiFetch("/worker/attendance/today", {
    method: "GET",
  });
}

export async function getWorkerAttendanceHistory(): Promise<WorkerAttendanceHistoryItem[]> {
  return apiFetch("/worker/attendance/history", {
    method: "GET",
  });
}

export async function workerCheckIn(notes?: string) {
  return apiFetch("/worker/attendance/check-in", {
    method: "POST",
    body: JSON.stringify({
      notes: notes || null,
    }),
  });
}

export async function workerCheckOut(notes?: string) {
  return apiFetch("/worker/attendance/check-out", {
    method: "POST",
    body: JSON.stringify({
      notes: notes || null,
    }),
  });
}
