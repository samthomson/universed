/**
 * Event timezone detection and formatting utilities.
 *
 * Supports timezone detection from multiple sources:
 * 1. NIP-52 timezone tags (start_tzid, end_tzid) - highest priority
 * 2. Other common timezone tags (tzid, timezone)
 * 3. Location-based timezone mapping - fallback
 *
 * For kind 31923 (time-based) events, the following tags are checked in order:
 * - start_tzid: Official NIP-52 timezone for start time
 * - end_tzid: Official NIP-52 timezone for end time
 * - tzid: Generic timezone identifier
 * - timezone: Alternative timezone tag
 *
 * Example usage:
 * Tags: [["start_tzid", "Europe/Madrid"], ["start", "1640995200"]]
 * Result: Event displayed in Madrid timezone (CET/CEST)
 */

// Comprehensive list of timezones organized by region
export const TIMEZONES = {
  // North America
  "America/New_York": "Eastern Time (ET)",
  "America/Chicago": "Central Time (CT)",
  "America/Denver": "Mountain Time (MT)",
  "America/Phoenix": "Mountain Time - Arizona (MT)",
  "America/Los_Angeles": "Pacific Time (PT)",
  "America/Anchorage": "Alaska Time (AKT)",
  "Pacific/Honolulu": "Hawaii Time (HT)",
  "America/Toronto": "Eastern Time - Toronto",
  "America/Vancouver": "Pacific Time - Vancouver",
  "America/Montreal": "Eastern Time - Montreal",
  "America/Edmonton": "Mountain Time - Edmonton",
  "America/Winnipeg": "Central Time - Winnipeg",
  "America/Halifax": "Atlantic Time - Halifax",
  "America/St_Johns": "Newfoundland Time",
  "America/Mexico_City": "Central Time - Mexico",
  "America/Tijuana": "Pacific Time - Tijuana",

  // Europe
  "Europe/London": "Greenwich Mean Time (GMT)",
  "Europe/Paris": "Central European Time (CET)",
  "Europe/Berlin": "Central European Time (CET)",
  "Europe/Rome": "Central European Time (CET)",
  "Europe/Madrid": "Central European Time (CET)",
  "Europe/Amsterdam": "Central European Time (CET)",
  "Europe/Brussels": "Central European Time (CET)",
  "Europe/Vienna": "Central European Time (CET)",
  "Europe/Zurich": "Central European Time (CET)",
  "Europe/Prague": "Central European Time (CET)",
  "Europe/Warsaw": "Central European Time (CET)",
  "Europe/Budapest": "Central European Time (CET)",
  "Europe/Athens": "Eastern European Time (EET)",
  "Europe/Istanbul": "Turkey Time",
  "Europe/Moscow": "Moscow Time",
  "Europe/Kiev": "Eastern European Time (EET)",
  "Europe/Stockholm": "Central European Time (CET)",
  "Europe/Oslo": "Central European Time (CET)",
  "Europe/Copenhagen": "Central European Time (CET)",
  "Europe/Dublin": "Greenwich Mean Time (GMT)",
  "Europe/Lisbon": "Western European Time (WET)",

  // Asia
  "Asia/Tokyo": "Japan Standard Time (JST)",
  "Asia/Seoul": "Korea Standard Time (KST)",
  "Asia/Shanghai": "China Standard Time (CST)",
  "Asia/Hong_Kong": "Hong Kong Time (HKT)",
  "Asia/Singapore": "Singapore Time (SGT)",
  "Asia/Bangkok": "Indochina Time (ICT)",
  "Asia/Mumbai": "India Standard Time (IST)",
  "Asia/Kolkata": "India Standard Time (IST)",
  "Asia/Dubai": "Gulf Standard Time (GST)",
  "Asia/Riyadh": "Arabia Standard Time (AST)",
  "Asia/Jerusalem": "Israel Standard Time (IST)",

  // Oceania
  "Australia/Sydney": "Australian Eastern Time (AET)",
  "Australia/Melbourne": "Australian Eastern Time (AET)",
  "Australia/Perth": "Australian Western Time (AWT)",
  "Australia/Adelaide": "Australian Central Time (ACT)",
  "Pacific/Auckland": "New Zealand Standard Time (NZST)",
  
  // Africa
  "Africa/Cairo": "Eastern European Time (EET)",
  "Africa/Johannesburg": "South Africa Standard Time (SAST)",
  "Africa/Lagos": "West Africa Time (WAT)",
  "Africa/Casablanca": "Western European Time (WET)",

  // UTC and other
  UTC: "Coordinated Universal Time (UTC)",
  GMT: "Greenwich Mean Time (GMT)",
};

/**
 * Gets the user's local timezone
 */
export function getUserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Validates if a timezone identifier is valid
 */
function isValidTimezone(timezone: string): boolean {
  try {
    // Try to create a DateTimeFormat with the timezone
    new Intl.DateTimeFormat("en", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

/**
 * Converts a date and time in a specific timezone to a Unix timestamp
 */
export function createTimestampInTimezone(
  dateString: string, // YYYY-MM-DD format
  timeString: string, // HH:MM format
  timezone: string
): number {
  try {
    // Parse the date and time components
    const [year, month, day] = dateString.split('-').map(Number);
    const [hours, minutes] = timeString.split(':').map(Number);

    // Create a date object representing the desired time in the target timezone
    // We'll use a binary search approach to find the correct UTC timestamp
    
    let low = new Date(year, month - 1, day, hours, minutes).getTime() - (24 * 60 * 60 * 1000); // 24 hours before
    let high = new Date(year, month - 1, day, hours, minutes).getTime() + (24 * 60 * 60 * 1000); // 24 hours after
    
    // Binary search to find the UTC timestamp that gives us the right local time
    while (high - low > 60000) { // Within 1 minute accuracy
      const mid = Math.floor((low + high) / 2);
      const testDate = new Date(mid);
      
      // Check what time this UTC timestamp shows in the target timezone
      const timeInTargetTz = testDate.toLocaleString("en-CA", {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      });
      
      // Parse the result
      const [datePart, timePart] = timeInTargetTz.split(', ');
      const [tzYear, tzMonth, tzDay] = datePart.split('-').map(Number);
      const [tzHours, tzMinutes] = timePart.split(':').map(Number);
      
      // Compare with our target
      if (tzYear < year || (tzYear === year && tzMonth < month) || 
          (tzYear === year && tzMonth === month && tzDay < day) ||
          (tzYear === year && tzMonth === month && tzDay === day && tzHours < hours) ||
          (tzYear === year && tzMonth === month && tzDay === day && tzHours === hours && tzMinutes < minutes)) {
        low = mid;
      } else if (tzYear > year || (tzYear === year && tzMonth > month) || 
                 (tzYear === year && tzMonth === month && tzDay > day) ||
                 (tzYear === year && tzMonth === month && tzDay === day && tzHours > hours) ||
                 (tzYear === year && tzMonth === month && tzDay === day && tzHours === hours && tzMinutes > minutes)) {
        high = mid;
      } else {
        // Exact match found
        return Math.floor(mid / 1000);
      }
    }
    
    // Return the closest match
    return Math.floor(low / 1000);
    
  } catch (error) {
    console.error("Error creating timestamp in timezone:", error);
    
    // Fallback to a simpler approach
    const dateTimeString = `${dateString}T${timeString}:00`;
    const localDate = new Date(dateTimeString);
    return Math.floor(localDate.getTime() / 1000);
  }
}

/**
 * Formats a date/time with timezone information
 */
export function formatEventDateTime(
  timestamp: number,
  timezone: string | null,
  options: Intl.DateTimeFormatOptions = {}
): string {
  let date: Date;
  
  try {
    // Handle both seconds and milliseconds timestamps
    if (timestamp < 10000000000) {
      // Likely in seconds, convert to milliseconds
      date = new Date(timestamp * 1000);
    } else {
      // Likely already in milliseconds
      date = new Date(timestamp);
    }
    
    // Validate the resulting date
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date created from timestamp: ${timestamp}`);
    }
    
  } catch (error) {
    console.error(`Error parsing timestamp ${timestamp}:`, error);
    // Fallback to current time to prevent crashes
    date = new Date();
  }

  const formatOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...options,
  };

  if (timezone) {
    try {
      return date.toLocaleDateString(undefined, {
        ...formatOptions,
        timeZone: timezone,
      });
    } catch (error) {
      console.warn(
        `Invalid timezone: ${timezone}, falling back to browser timezone. Error:`,
        error
      );
    }
  }

  // Fallback to browser timezone
  return date.toLocaleDateString(undefined, formatOptions);
}

/**
 * Gets a formatted timezone list for display in select components
 */
export function getTimezoneOptions(): Array<{ value: string; label: string }> {
  return Object.entries(TIMEZONES).map(([value, label]) => ({
    value,
    label: `${label} (${value})`,
  }));
}

/**
 * Gets timezone options grouped by region for better organization
 */
export function getGroupedTimezoneOptions(): Array<{
  group: string;
  options: Array<{ value: string; label: string }>;
}> {
  const groups: Record<string, Array<{ value: string; label: string }>> = {
    "North America": [],
    Europe: [],
    Asia: [],
    Africa: [],
    Oceania: [],
    Other: [],
  };

  Object.entries(TIMEZONES).forEach(([value, label]) => {
    if (value.startsWith("America/")) {
      groups["North America"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Europe/")) {
      groups["Europe"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Asia/")) {
      groups["Asia"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Africa/")) {
      groups["Africa"].push({ value, label: `${label} (${value})` });
    } else if (value.startsWith("Australia/") || value.startsWith("Pacific/")) {
      groups["Oceania"].push({ value, label: `${label} (${value})` });
    } else {
      groups["Other"].push({ value, label: `${label} (${value})` });
    }
  });

  return Object.entries(groups)
    .filter(([_, options]) => options.length > 0)
    .map(([group, options]) => ({ group, options }));
}