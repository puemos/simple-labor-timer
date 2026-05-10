type DateInput = string | number | Date | undefined;

const dateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'short',
  day: 'numeric',
});

const timeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
});

const compactDateTimeFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function formatDateTime(value: DateInput): string {
  const date = validDate(value);
  return date ? dateTimeFormatter.format(date) : '';
}

export function formatCompactDateTime(value: DateInput): string {
  const date = validDate(value);
  if (!date) {
    return '';
  }

  if (sameLocalDay(date, new Date())) {
    return `Today, ${timeFormatter.format(date)}`;
  }

  return compactDateTimeFormatter.format(date);
}

export function formatDateOnly(value: DateInput): string {
  const date = validDate(value);
  return date ? dateFormatter.format(date) : '';
}

export function formatTimeOnly(value: DateInput): string {
  const date = validDate(value);
  return date ? timeFormatter.format(date) : '';
}

export function formatEditableDateTime(value: DateInput): string {
  const date = validDate(value);
  if (!date) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

export function formatDateTimeLocalInputValue(value: DateInput): string {
  const date = typeof value === 'string' ? parseLocalDateTime(value) ?? validDate(value) : validDate(value);
  if (!date) {
    return '';
  }
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes(),
  )}:${pad(date.getSeconds())}`;
}

export function formatDateTimeInputValue(value: string): string {
  return isIsoTimestamp(value) ? formatEditableDateTime(value) : value;
}

export function dateTimeInputValueToDate(value: string, fallback = new Date()): Date {
  return parseLocalDateTime(value) ?? validDate(value) ?? fallback;
}

export function normalizeDateTimeToIso(value: string, fallbackIso = new Date().toISOString()): string {
  const localDate = parseLocalDateTime(value);
  if (localDate) {
    return localDate.toISOString();
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallbackIso : new Date(parsed).toISOString();
}

export function normalizeDateOnly(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (isoDate) {
    const [, year, month, day] = isoDate;
    const date = localDate(Number(year), Number(month), Number(day));
    return date ? `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` : undefined;
  }

  const parsed = Date.parse(trimmed);
  if (Number.isNaN(parsed)) {
    return undefined;
  }

  const date = new Date(parsed);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function validDate(value: DateInput): Date | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (typeof value === 'string') {
    const isoDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
    if (isoDate) {
      const [, year, month, day] = isoDate;
      return localDate(Number(year), Number(month), Number(day));
    }
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function parseLocalDateTime(value: string): Date | undefined {
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?$/.exec(value.trim());
  if (!match) {
    return undefined;
  }

  const [, year, month, day, hour = '0', minute = '0', second = '0'] = match;
  return localDate(Number(year), Number(month), Number(day), Number(hour), Number(minute), Number(second));
}

function localDate(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date | undefined {
  const date = new Date(year, month - 1, day, hour, minute, second);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second
  ) {
    return undefined;
  }
  return date;
}

function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(value.trim());
}

function sameLocalDay(first: Date, second: Date): boolean {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function pad(value: number): string {
  return value.toString().padStart(2, '0');
}
