import { useClientValue } from "@/hooks/use-client";
import {
  formatEventDate,
  formatEventTimeRange,
  UTC_EVENT_TIME_FORMAT,
  viewerEventTimeFormat,
} from "@/lib/events/event-sources";

export function useEventTimeRange(event: { startAt: string; endAt: string | null }) {
  return useClientValue(
    () => formatEventTimeRange(event, viewerEventTimeFormat()),
    formatEventTimeRange(event, UTC_EVENT_TIME_FORMAT),
  );
}

export function useEventDateLabel(event: { startAt: string }) {
  return useClientValue(
    () => formatEventDate(event, viewerEventTimeFormat()),
    formatEventDate(event, UTC_EVENT_TIME_FORMAT),
  );
}
