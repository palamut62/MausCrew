/**
 * Cookie domains, normalized to something a person recognizes.
 *
 * A leading dot means "and every subdomain" in the cookie's own syntax and
 * is noise to a reader, so `.github.com` and `github.com` are one entry.
 * Nothing but the domain is read: a cookie's name and value *are* the
 * session, and they have no reason to leave the process that holds them.
 */
export function originsFromCookies(cookies) {
    const origins = new Set();
    for (const cookie of cookies) {
        const domain = String(cookie.domain ?? "").replace(/^\./, "").trim().toLowerCase();
        if (domain)
            origins.add(domain);
    }
    return [...origins].sort();
}
