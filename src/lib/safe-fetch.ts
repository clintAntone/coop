/**
 * Safely reads the text of a Response and parses it as JSON to prevent 
 * WebKit/Safari-specific DOMException: "The string did not match the expected pattern"
 * when parsing empty, malformed, or HTML error bodies on non-2xx status responses.
 */
export async function safeReadJson(res: Response): Promise<any> {
  let text = '';
  try {
    text = await res.text();
  } catch (err: any) {
    throw new Error(`Failed to read response stream: ${err.message || err}`);
  }

  if (!text || text.trim() === '') {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch (parseErr: any) {
    // If response was HTML (common for server-side exceptions or nginx gateway errors)
    const trimmed = text.trim();
    if (trimmed.startsWith('<!doctype html>') || trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE html>')) {
      throw new Error(`Server returned HTML instead of JSON (Status ${res.status}). Detailed error log check is recommended.`);
    }
    throw new Error(text.slice(0, 150) || `Invalid JSON response format (Status ${res.status})`);
  }
}
