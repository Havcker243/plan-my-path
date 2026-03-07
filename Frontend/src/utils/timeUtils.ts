import { CourseSection, MeetingTime } from '@/types/planner';

/**
 * Day mapping for converting day letters to numbers
 * M=Monday(1), T=Tuesday(2), W=Wednesday(3), R=Thursday(4), F=Friday(5), S=Saturday(6), U=Sunday(0)
 */
const dayMap: Record<string, number> = {
  M: 1,
  T: 2,
  W: 3,
  R: 4,
  F: 5,
  S: 6,
  U: 0,
};

/**
 * Parse meeting days string (e.g., "MWF", "TR") into array of day numbers
 * Handles "Th" → "R" conversion and slash-separated days
 * @param days - Day string like "MWF", "TR", "M/W/F"
 * @returns Array of day numbers (0-6, where 0=Sunday, 1=Monday, etc.)
 */
export const parseMeetingDays = (days: string): number[] => {
  if (!days) return [];

  // Replace "Th" with "R" (Thursday)
  const normalized = days.replace(/Th/gi, 'R');

  // Remove slashes and split into individual characters
  const tokens = normalized.split('/').join('');

  return tokens
    .split('')
    .map((token) => dayMap[token])
    .filter((value) => value !== undefined);
};

/**
 * Convert time string (HH:MM) to minutes since midnight
 * @param time - Time string in format "HH:MM" (e.g., "09:00", "13:30")
 * @returns Minutes since midnight (e.g., 540 for "09:00")
 */
export const parseTimeToMinutes = (time: string): number => {
  if (!time || !time.includes(':')) return 0;

  const [hours, minutes] = time.split(':').map(Number);

  if (isNaN(hours) || isNaN(minutes)) return 0;

  return hours * 60 + minutes;
};

/**
 * Check if two time ranges overlap
 * Back-to-back classes (e.g., 9:00-10:00 and 10:00-11:00) are NOT considered overlapping
 * @param start1 - Start time of first range (e.g., "09:00")
 * @param end1 - End time of first range (e.g., "10:15")
 * @param start2 - Start time of second range (e.g., "09:30")
 * @param end2 - End time of second range (e.g., "10:45")
 * @returns true if the time ranges overlap
 */
export const hasTimeOverlap = (
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean => {
  const start1Min = parseTimeToMinutes(start1);
  const end1Min = parseTimeToMinutes(end1);
  const start2Min = parseTimeToMinutes(start2);
  const end2Min = parseTimeToMinutes(end2);

  // Check for invalid times
  if (start1Min === 0 || end1Min === 0 || start2Min === 0 || end2Min === 0) {
    return false;
  }

  // Two ranges overlap if:
  // - Range 1 starts before Range 2 ends AND
  // - Range 2 starts before Range 1 ends
  // Using < instead of <= means back-to-back classes don't conflict
  return start1Min < end2Min && start2Min < end1Min;
};

/**
 * Check if two day strings share any common days
 * @param days1 - First day string (e.g., "MWF")
 * @param days2 - Second day string (e.g., "MW")
 * @returns true if any days overlap
 */
export const hasDayOverlap = (days1: string, days2: string): boolean => {
  if (!days1 || !days2) return false;

  const daySet1 = parseMeetingDays(days1);
  const daySet2 = parseMeetingDays(days2);

  return daySet1.some((day) => daySet2.includes(day));
};

/**
 * Check if a section should skip time conflict detection
 * Returns true for TBA times, online courses, or asynchronous courses
 * @param section - Course section to check
 * @returns true if conflict detection should be skipped
 */
export const isTBAOrOnline = (section: CourseSection | null | undefined): boolean => {
  if (!section) return true;

  // Check if modality indicates online/asynchronous
  const modality = section.modality?.toLowerCase() || '';
  if (modality.includes('online') || modality.includes('asynchronous') || modality.includes('web')) {
    return true;
  }

  // Check if meeting times are TBA or missing
  const meetingTimes = section.meeting_times;
  if (!meetingTimes || meetingTimes.length === 0) {
    return true;
  }

  // Check if first meeting time has required fields
  const firstMeeting = meetingTimes[0];
  if (!firstMeeting.days || !firstMeeting.start_time || !firstMeeting.end_time) {
    return true;
  }

  // Check for common TBA indicators
  if (
    firstMeeting.days.toLowerCase().includes('tba') ||
    firstMeeting.start_time.toLowerCase().includes('tba') ||
    firstMeeting.end_time.toLowerCase().includes('tba')
  ) {
    return true;
  }

  return false;
};

/**
 * Check if two meeting times conflict
 * @param meeting1 - First meeting time
 * @param meeting2 - Second meeting time
 * @returns true if the meetings have overlapping days and times
 */
export const doMeetingTimesConflict = (
  meeting1: MeetingTime | undefined,
  meeting2: MeetingTime | undefined
): boolean => {
  if (!meeting1 || !meeting2) return false;

  // Check required fields
  if (
    !meeting1.days ||
    !meeting1.start_time ||
    !meeting1.end_time ||
    !meeting2.days ||
    !meeting2.start_time ||
    !meeting2.end_time
  ) {
    return false;
  }

  // Check if days overlap
  if (!hasDayOverlap(meeting1.days, meeting2.days)) {
    return false;
  }

  // Check if times overlap
  return hasTimeOverlap(
    meeting1.start_time,
    meeting1.end_time,
    meeting2.start_time,
    meeting2.end_time
  );
};

/**
 * Format meeting time for display
 * @param meeting - Meeting time object
 * @returns Formatted string like "MWF 09:00-10:15 Science Hall 101"
 */
export const formatMeetingTime = (meeting: MeetingTime): string => {
  const time =
    meeting.start_time && meeting.end_time
      ? `${meeting.start_time}-${meeting.end_time}`
      : 'Time TBA';
  const place = [meeting.building, meeting.room].filter(Boolean).join(' ');
  return `${meeting.days || ''} ${time} ${place}`.trim();
};
