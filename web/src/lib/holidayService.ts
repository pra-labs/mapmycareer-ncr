export interface PublicHoliday {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
}

const holidayCache = new Map<number, PublicHoliday[]>();

export async function fetchIndianHolidays(year: number): Promise<PublicHoliday[]> {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  // Check localStorage if available
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem(`in_holidays_${year}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        holidayCache.set(year, parsed);
        return parsed;
      }
    } catch {
      // Ignore
    }
  }

  try {
    const res = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${year}/IN`);
    if (res.ok) {
      const data: PublicHoliday[] = await res.json();
      holidayCache.set(year, data);
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`in_holidays_${year}`, JSON.stringify(data));
        } catch {
          // Ignore
        }
      }
      return data;
    }
  } catch (err) {
    console.warn('Failed to fetch public holidays from Nager.Date, using fallback', err);
  }

  // Curated Fallback for Indian Gazetted Holidays
  const fallbackHolidays: PublicHoliday[] = [
    { date: `${year}-01-26`, localName: 'Republic Day', name: 'Republic Day', countryCode: 'IN', fixed: true, global: true, counties: null, launchYear: 1950, types: ['Public'] },
    { date: `${year}-08-15`, localName: 'Independence Day', name: 'Independence Day', countryCode: 'IN', fixed: true, global: true, counties: null, launchYear: 1947, types: ['Public'] },
    { date: `${year}-10-02`, localName: 'Mahatma Gandhi Jayanti', name: 'Mahatma Gandhi Jayanti', countryCode: 'IN', fixed: true, global: true, counties: null, launchYear: 1948, types: ['Public'] },
    { date: `${year}-03-25`, localName: 'Holi', name: 'Holi', countryCode: 'IN', fixed: false, global: true, counties: null, launchYear: null, types: ['Public'] },
    { date: `${year}-11-01`, localName: 'Diwali (Deepavali)', name: 'Diwali', countryCode: 'IN', fixed: false, global: true, counties: null, launchYear: null, types: ['Public'] },
    { date: `${year}-12-25`, localName: 'Christmas Day', name: 'Christmas Day', countryCode: 'IN', fixed: true, global: true, counties: null, launchYear: null, types: ['Public'] },
  ];

  holidayCache.set(year, fallbackHolidays);
  return fallbackHolidays;
}

export interface NoticePeriodCalculation {
  resignationDate: string;
  noticePeriodDays: number;
  lastWorkingDay: string;
  totalCalendarDays: number;
  weekendDays: number;
  workingDays: number;
  publicHolidaysCount: number;
  holidaysDuringNotice: { date: string; name: string }[];
}

export async function calculateNoticePeriod(
  resignationDateStr: string,
  noticePeriodDays: number
): Promise<NoticePeriodCalculation> {
  const startDate = new Date(resignationDateStr);
  if (isNaN(startDate.getTime())) {
    throw new Error('Invalid resignation date');
  }

  // End Date = startDate + noticePeriodDays
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + noticePeriodDays);

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Fetch holidays for relevant years
  const holidaysYears = new Set([startYear, endYear]);
  const holidaysList: PublicHoliday[] = [];
  for (const yr of holidaysYears) {
    const list = await fetchIndianHolidays(yr);
    holidaysList.push(...list);
  }

  const holidayDateMap = new Map<string, string>();
  for (const h of holidaysList) {
    holidayDateMap.set(h.date, h.name || h.localName);
  }

  let weekendDays = 0;
  let holidaysCount = 0;
  const holidaysDuringNotice: { date: string; name: string }[] = [];

  const curr = new Date(startDate);
  // Notice starts the next day after resignation or day of resignation? In India, day 1 is typically day+1, let's count from next day to endDate
  curr.setDate(curr.getDate() + 1);

  while (curr <= endDate) {
    const dayOfWeek = curr.getDay(); // 0 = Sun, 6 = Sat
    const dateStr = curr.toISOString().split('T')[0];

    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    if (isWeekend) {
      weekendDays++;
    } else if (holidayDateMap.has(dateStr)) {
      holidaysCount++;
      holidaysDuringNotice.push({
        date: dateStr,
        name: holidayDateMap.get(dateStr)!,
      });
    }

    curr.setDate(curr.getDate() + 1);
  }

  const totalCalendarDays = noticePeriodDays;
  const workingDays = Math.max(0, totalCalendarDays - weekendDays - holidaysCount);

  return {
    resignationDate: resignationDateStr,
    noticePeriodDays,
    lastWorkingDay: endDate.toISOString().split('T')[0],
    totalCalendarDays,
    weekendDays,
    workingDays,
    publicHolidaysCount: holidaysCount,
    holidaysDuringNotice,
  };
}
