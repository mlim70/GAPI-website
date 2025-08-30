// backend/src/utils/sanitizer.ts

/**
 * Shared sanitizer utility for HTML content
 * @param html HTML content to sanitize
 * @param mode "snippet" for preview text, "full" for complete HTML
 * @param maxLength Maximum length for snippet mode
 * @returns Sanitized content
 */
export function sanitizeHtml(
  html?: string, 
  mode: "snippet" | "full" = "full",
  maxLength: number = 160
): string | undefined {
  if (!html || typeof html !== 'string') return undefined;
  
  if (mode === "snippet") {
    // Snippet mode: extract text and clean it
    let text = html
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    
    // Clean up template variables and placeholder content
    text = text
      .replace(/\{\$[^}]+\}/g, '') // Remove {$subject} type variables
      .replace(/\{\{[^}]+\}\}/g, '') // Remove {{ subject }} type variables
      .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Remove zero-width characters
      .replace(/\s+/g, ' ') // Clean up excessive whitespace
      .trim();
    
    return text ? (text.length > maxLength ? text.slice(0, maxLength - 1) + '…' : text) : undefined;
  }
  
  // Full mode: return cleaned HTML for further processing
  return html
    .replace(/\{\$[^}]+\}/g, '') // Remove {$subject} type variables
    .replace(/\{\{[^}]+\}\}/g, '') // Remove {{ subject }} type variables
    .replace(/[\u200B\u200C\u200D\uFEFF]/g, '') // Remove zero-width characters
    .trim();
}

/**
 * Extract text snippet from HTML content (convenience function)
 */
export function toSnippet(html?: string, max = 160): string | undefined {
  return sanitizeHtml(html, "snippet", max);
}
