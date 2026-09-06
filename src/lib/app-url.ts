export function getAppUrl() {
  return process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
}

export function getRaterLink(token: string) {
  return `${getAppUrl()}/respond/${token}`;
}
