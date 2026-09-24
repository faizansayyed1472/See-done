/**
 * Safe dialog helper to avoid unhandled security errors in sandboxed iframes
 */
export function safeConfirm(message: string): boolean {
  try {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
  } catch {
    // In sandboxed environments where window.confirm may be restricted
    return true;
  }
  return true;
}
