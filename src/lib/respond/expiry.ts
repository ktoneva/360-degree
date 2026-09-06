export function isLinkExpired(invitedAt: string, linkExpiryDays: number): boolean {
  const expiresAt = new Date(invitedAt).getTime() + linkExpiryDays * 24 * 60 * 60 * 1000;
  return Date.now() > expiresAt;
}
