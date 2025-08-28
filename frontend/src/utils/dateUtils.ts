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
  
  // Parse the date string (e.g., "July 18-19, 2025" or "July 18, 2025")
  const yearMatch = dateStr.match(/(\d{4})/);
  if (!yearMatch) return false;
  
  const eventYear = parseInt(yearMatch[1]);
  const currentYear = new Date().getFullYear();
  
  if (eventYear > currentYear) return true;
  if (eventYear < currentYear) return false;
  
  // Same year - check if the event has passed
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth(); // 0-11
  
  // Simple month comparison (July = 6)
  const monthMap: { [key: string]: number } = {
    'january': 0, 'february': 1, 'march': 2, 'april': 3, 'may': 4, 'june': 5,
    'july': 6, 'august': 7, 'september': 8, 'october': 9, 'november': 10, 'december': 11
  };
  
  const eventMonth = monthMap[dateStr.toLowerCase().split(' ')[0]];
  if (eventMonth === undefined) return false;
  
  return eventMonth >= currentMonth;
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
