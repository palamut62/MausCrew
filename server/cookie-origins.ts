// Which sites a browser profile is signed into, derived from its cookies.
//
// Its own module because the sign-in child (drivers/playwright-signin.ts) is
// the only place cookies exist, and that file cannot be imported by a test
// without launching a browser. The rule itself — domains only, never a name
// or a value — is worth testing on its own.
export interface CookieLike {
  domain?: string;
}

/**
 * Cookie domains, normalized to something a person recognizes.
 *
 * A leading dot means "and every subdomain" in the cookie's own syntax and
 * is noise to a reader, so `.github.com` and `github.com` are one entry.
 * Nothing but the domain is read: a cookie's name and value *are* the
 * session, and they have no reason to leave the process that holds them.
 */
export function originsFromCookies(cookies: readonly CookieLike[]): string[] {
  const origins = new Set<string>();
  for (const cookie of cookies) {
    const domain = String(cookie.domain ?? "").replace(/^\./, "").trim().toLowerCase();
    if (domain) origins.add(domain);
  }
  return [...origins].sort();
}
