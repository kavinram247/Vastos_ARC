// Lightweight cross-page handoff: when one workflow creates a document and
// navigates to another page (e.g. approved Material Request → draft PO), it
// stashes the new record id here so the target page can open it on mount.
const pending = new Map<string, string>();

export function setPendingOpen(page: string, id: string) { pending.set(page, id); }
export function takePendingOpen(page: string): string | undefined {
  const v = pending.get(page);
  if (v) pending.delete(page);
  return v;
}
