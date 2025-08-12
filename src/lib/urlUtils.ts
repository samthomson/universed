/**
 * Extracts URLs from text content
 * @param text The text content to extract URLs from
 * @returns Array of URLs found in the text
 */
export function extractUrls(text: string): string[] {
  if (!text) return [];
  
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const matches = text.match(urlRegex);
  
  if (!matches) return [];
  
  // Remove duplicates and return
  return [...new Set(matches)];
}

/**
 * Gets the first URL from text content
 * @param text The text content to extract URL from
 * @returns First URL found in the text, or undefined
 */
export function getFirstUrl(text: string): string | undefined {
  const urls = extractUrls(text);
  return urls[0];
}

/**
 * Removes URLs from text content
 * @param text The text content to remove URLs from
 * @param urlsToRemove Optional specific URLs to remove (removes all if not provided)
 * @returns Text with URLs removed
 */
export function removeUrls(text: string, urlsToRemove?: string[]): string {
  if (!text) return '';
  
  const urls = urlsToRemove || extractUrls(text);
  let result = text;
  
  urls.forEach(url => {
    // Escape special characters in URL for regex
    const escapedUrl = url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escapedUrl, 'g'), '').trim();
  });
  
  // Clean up extra whitespace that might be left after URL removal
  return result.replace(/\s+/g, ' ').trim();
}
