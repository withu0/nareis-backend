/**
 * Convert a string to a URL-friendly slug
 * @param text - The text to convert
 * @returns URL-friendly slug
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-')      // Replace spaces with hyphens
    .replace(/-+/g, '-')       // Replace multiple hyphens with single
    .trim();
}

/**
 * Generate a unique slug with timestamp
 * @param text - The text to convert
 * @returns Unique slug with timestamp
 */
export function generateUniqueSlug(text: string): string {
  const baseSlug = slugify(text);
  const timestamp = Date.now();
  return `${baseSlug}-${timestamp}`;
}
