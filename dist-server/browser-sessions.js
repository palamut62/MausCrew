const DEFAULT_PORTS = [9222, 9223, 9229, 9333];
async function json(fetcher, url) {
    const response = await fetcher(url, { signal: AbortSignal.timeout(450) });
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    return response.json();
}
/** Discover only explicit localhost CDP endpoints. A normal browser profile is
 * never scraped or copied: the user must have launched the browser with remote
 * debugging, making the trust boundary visible and reversible. */
export async function discoverBrowserSessions(ports = DEFAULT_PORTS, fetcher = fetch) {
    const settled = await Promise.allSettled(ports.map(async (port) => {
        const endpoint = `http://127.0.0.1:${port}`;
        const version = (await json(fetcher, `${endpoint}/json/version`));
        if (typeof version.webSocketDebuggerUrl !== "string")
            throw new Error("not a CDP browser");
        const rows = (await json(fetcher, `${endpoint}/json/list`));
        const tabs = Array.isArray(rows)
            ? rows
                .filter((row) => row && typeof row === "object" && row.type === "page")
                .map((row) => {
                const tab = row;
                return {
                    id: typeof tab.id === "string" ? tab.id : "",
                    title: typeof tab.title === "string" ? tab.title.slice(0, 200) : "Untitled",
                    url: typeof tab.url === "string" ? tab.url.slice(0, 2_000) : "",
                };
            })
            : [];
        return {
            endpoint,
            browser: typeof version.Browser === "string" ? version.Browser : "Chromium",
            userAgent: typeof version["User-Agent"] === "string" ? version["User-Agent"] : "",
            tabs,
        };
    }));
    return settled.flatMap((outcome) => (outcome.status === "fulfilled" ? [outcome.value] : []));
}
export function validBrowserEndpoint(value) {
    if (typeof value !== "string" || !value.trim())
        return null;
    try {
        const url = new URL(value.trim());
        if (url.protocol !== "http:" || (url.hostname !== "127.0.0.1" && url.hostname !== "localhost"))
            return null;
        if (!url.port)
            return null;
        return `${url.protocol}//${url.hostname}:${url.port}`;
    }
    catch {
        return null;
    }
}
