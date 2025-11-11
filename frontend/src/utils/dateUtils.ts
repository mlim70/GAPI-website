// frontend/src/utils/dateUtils.ts

/**
 * Parse event date strings into Date objects
 * Handles formats like "July 18-19, 2025" or "March 22, 2025"
 */
export const parseEventDate = (dateStr: string): Date => {
  // Handle ranges like "July 18-19, 2025" by taking the first date
  const cleanDateStr = dateStr.split('-')[0].trim();
  
  // Try to parse the date
  const parsed = new Date(cleanDateStr);
  
  // If parsing fails, try to handle common formats
  if (isNaN(parsed.getTime())) {
    // Handle "Month Day, Year" format
    const monthDayYear = cleanDateStr.match(/(\w+)\s+(\d+),\s+(\d{4})/);
    if (monthDayYear) {
      const [, month, day, year] = monthDayYear;
      const monthIndex = new Date(`${month} 1, 2000`).getMonth();
      return new Date(parseInt(year), monthIndex, parseInt(day));
    }
  }
  
  return parsed;
};

/**
 * Determine if an event is upcoming based on its date
 * Uses a simpler approach for quick checks (like in hero carousel)
 */
export const isEventUpcoming = (dateStr: string): boolean => {
  if (!dateStr) return false;
  
  try {
    const eventDate = parseEventDate(dateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset time to start of day
    
    return eventDate >= today;
  } catch (error) {
    return false;
  }
};

/**
 * Categorize events into upcoming and past based on date
 * Returns sorted arrays for both categories
 */
export const categorizeEvents = <T extends { date: string }>(events: T[]) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Reset time to start of day
  
  const upcoming: T[] = [];
  const past: T[] = [];
  
  events.forEach(event => {
    const eventDate = parseEventDate(event.date);
    
    if (eventDate >= today) {
      upcoming.push(event);
    } else {
      past.push(event);
    }
  });
  
  // Sort upcoming events by date (earliest first)
  upcoming.sort((a, b) => parseEventDate(a.date).getTime() - parseEventDate(b.date).getTime());
  
  // Sort past events by date (most recent first)
  past.sort((a, b) => parseEventDate(b.date).getTime() - parseEventDate(a.date).getTime());
  
  return { upcomingEvents: upcoming, pastEvents: past };
};
