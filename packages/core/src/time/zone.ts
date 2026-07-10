export type Result<T> =
  | {
      issues: string[];
      ok: false;
    }
  | {
      ok: true;
      value: T;
    };

export function add(a: number, b: number): number {
  return a + b;
}

export function buildGreetingMessage(input: {
  name: string;
  now?: Date;
  offsetHours: number;
}): Result<string> {
  if (!Number.isFinite(input.offsetHours)) {
    return {
      issues: ["offsetHours must be a finite number."],
      ok: false,
    };
  }

  const now = input.now ?? new Date();
  const greenwichHour = now.getUTCHours();
  const personHour = normalizeHour(greenwichHour + input.offsetHours);

  return {
    ok: true,
    value: `Good ${dayPart(personHour)} ${input.name}! It is ${dayPart(greenwichHour)} in Greenwich`,
  };
}

export function dayPart(hour: number): string {
  if (hour > 15) {
    if (hour > 18) {
      return "night";
    }
    return "afternoon";
  }
  return "morning";
}

export function greet(name: string): string {
  return `zone says: hello to ${name}`;
}

function normalizeHour(hour: number): number {
  return ((hour % 24) + 24) % 24;
}
export const meaning: { life: number } = {
  life: 42,
};
export const TIME_WINDOW = 2;

export function allowedTimeZones(
  now = new Date(),
  window = TIME_WINDOW,
): string[] {
  const supported = Intl.supportedValuesOf("timeZone");
  return supported.filter((zone) =>
    isTimeZoneWithinUtcWindow(zone, window, now),
  );
}
export function isTimeZoneWithinUtcWindow(
  timeZone: string,
  window = TIME_WINDOW,
  now = new Date(),
): boolean {
  const offset = timeZoneUtcOffsetMinutes(timeZone, now);
  if (offset === null) {
    return false;
  }
  return Math.abs(offset) <= window * 60;
}

export function isValidIntlTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function timeZoneUtcOffsetMinutes(
  timeZone: string,
  now = new Date(),
): null | number {
  if (!isValidIntlTimeZone(timeZone)) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    timeZoneName: "shortOffset",
  }).formatToParts(now);

  const offsetLabel = parts.find((part) => part.type === "timeZoneName")?.value;
  if (!offsetLabel) {
    return null;
  }

  return parseGmtOffsetToMinutes(offsetLabel);
}

function parseGmtOffsetToMinutes(offsetLabel: string): null | number {
  if (offsetLabel === "GMT") {
    return 0;
  }

  const match = /^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(offsetLabel);
  if (!match) {
    return null;
  }

  const sign = match[1] === "+" ? 1 : -1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes);
}
