// Handing a bot to someone else.
//
// The receiving half of this already existed: MausCrew registers the
// `mauscrew://` scheme and opens an import dialog when a link fires (see
// lib/deep-link.ts). What was missing was the sending half — nothing in the
// app could produce such a link from a bot you already have, so the import
// path could only ever be reached from a website.
//
// Deliberately a link and not an upload: no MausCrew server exists to host a
// shared profile, and inventing one would put a bot's instructions on someone
// else's disk. Everything the recipient needs travels in the URL, they see it
// in the import dialog before anything is created, and no credential, key,
// workspace path or transcript is carried.
export interface ShareableBot {
  name: string;
  title?: string;
  description?: string;
}

/** Long descriptions make links that break when pasted into chat apps that
 * wrap. Trimmed with an ellipsis so the recipient can tell it was cut. */
const DESCRIPTION_LIMIT = 1200;

export function botShareLink(bot: ShareableBot): string {
  const params = new URLSearchParams();
  params.set("name", bot.name.trim().slice(0, 64));
  if (bot.title?.trim()) params.set("title", bot.title.trim().slice(0, 200));
  const description = bot.description?.trim() ?? "";
  if (description) {
    params.set(
      "description",
      description.length > DESCRIPTION_LIMIT ? `${description.slice(0, DESCRIPTION_LIMIT - 1)}…` : description,
    );
  }
  return `mauscrew://bot/add?${params.toString()}`;
}
