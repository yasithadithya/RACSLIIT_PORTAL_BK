import { RRule } from 'rrule';
import { IEvent } from '../models/Event';

export interface ExpandedEventInstance {
  [key: string]: any;
  _id: any;
  instanceId: string;
  title: string;
  description?: string;
  location: string;
  startTime: Date;
  endTime: Date;
  isRecurringInstance: boolean;
}

// Expands events with a stored RRULE `recurringRule` into virtual instances within
// [rangeStart, rangeEnd]. Occurrences are computed on read — nothing is persisted.
export function expandRecurringEvents(
  events: IEvent[],
  rangeStart: Date,
  rangeEnd: Date
): ExpandedEventInstance[] {
  const result: ExpandedEventInstance[] = [];

  for (const eventDoc of events) {
    const event: any = typeof (eventDoc as any).toObject === 'function' ? (eventDoc as any).toObject() : eventDoc;

    if (!event.recurringRule) {
      result.push({
        ...event,
        instanceId: `${event._id}@racsliit.org`,
        isRecurringInstance: false,
      });
      continue;
    }

    try {
      const options = RRule.parseString(event.recurringRule);
      options.dtstart = event.startTime;
      const rule = new RRule(options);
      const durationMs = new Date(event.endTime).getTime() - new Date(event.startTime).getTime();

      const occurrences = rule.between(rangeStart, rangeEnd, true);
      occurrences.forEach((occurrenceStart: Date) => {
        result.push({
          ...event,
          instanceId: `${event._id}-${occurrenceStart.getTime()}@racsliit.org`,
          startTime: occurrenceStart,
          endTime: new Date(occurrenceStart.getTime() + durationMs),
          isRecurringInstance: true,
        });
      });
    } catch {
      // Malformed recurringRule — fall back to the single base occurrence
      result.push({
        ...event,
        instanceId: `${event._id}@racsliit.org`,
        isRecurringInstance: false,
      });
    }
  }

  return result;
}
