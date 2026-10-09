import { addDays, isoToUtcMs } from "./dates";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function simClockParts(today: string, startHour: number, clockMinutes: number) {
  const total = startHour * 60 + clockMinutes;
  const dayOffset = Math.floor(total / 1440);
  const minuteOfDay = total % 1440;
  const date = new Date(isoToUtcMs(addDays(today, dayOffset)));
  const hh = String(Math.floor(minuteOfDay / 60)).padStart(2, "0");
  const mm = String(minuteOfDay % 60).padStart(2, "0");
  return {
    date: `${DAYS[date.getUTCDay()]}, ${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`,
    time: `${hh}:${mm}`,
  };
}
