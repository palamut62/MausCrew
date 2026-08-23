import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { InitialsAvatar, MausAvatar, monogramFor } from "@/components/Avatar";
import { MAUS_COLOR_NAMES, MAUS_COLORS } from "@/lib/mascot";
import "./styles.css";
import "./mascot-preview.css";

/** Every size the app actually renders avatars at. */
const SIZES = [16, 20, 24, 36, 48, 86];

const MONOGRAM_SAMPLES = ["Deep Seek", "Scout", "X", null];

function Preview() {
  return (
    <main className="preview-shell">
      <header className="preview-header">
        <div>
          <p className="eyebrow">
            Avatar identity system · {MAUS_COLOR_NAMES.length} accents
          </p>
          <h1>Avatar gallery</h1>
          <p className="intro">
            Every bot tile is the same mark — an accent field with two asymmetric
            eye notches — recolored per bot. This page checks that each accent
            holds up at every size the app renders (16px list rows to 220px call
            stages) and that derived monograms stay legible.
          </p>
        </div>
      </header>

      <section aria-labelledby="sizes-heading">
        <div className="section-heading">
          <div>
            <h2 id="sizes-heading">Colors × sizes</h2>
          </div>
          <p>
            Same tile at every scale — nothing but size changes between a
            sidebar row and a call-stage avatar.
          </p>
        </div>

        <div className="matrix-wrap">
          <div className="matrix">
            <div className="corner-label">Color ↓ / size →</div>
            {SIZES.map((s) => (
              <div className="column-label" key={s}>
                <strong>{s}px</strong>
              </div>
            ))}

            {MAUS_COLOR_NAMES.map((c) => (
              <div className="matrix-row" key={c}>
                <div className="row-label">
                  <span className="swatch" style={{ background: MAUS_COLORS[c] }} />
                  <strong>{c}</strong>
                  <code>{MAUS_COLORS[c]}</code>
                </div>
                {SIZES.map((s) => (
                  <div className="mascot-cell" key={`${c}-${s}`}>
                    <MausAvatar color={c} name={c} size={s} />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="monograms-heading">
        <div className="section-heading">
          <div>
            <h2 id="monograms-heading">Monograms</h2>
          </div>
          <p>
            Groups and nameless records fall back to initials: two words give a
            letter each, one word its first two, nothing a question mark.
          </p>
        </div>

        <div className="chips monogram-row">
          {MONOGRAM_SAMPLES.map((name) => (
            <figure className="monogram-card" key={name ?? "empty"}>
              <InitialsAvatar initials={monogramFor(name)} size={44} />
              <figcaption>
                <code>{monogramFor(name)}</code>
                <span>{name ? `“${name}”` : "no name"}</span>
              </figcaption>
            </figure>
          ))}
          {MAUS_COLOR_NAMES.slice(0, 6).map((c) => (
            <figure className="monogram-card" key={`tile-${c}`}>
              <MausAvatar color={c} name={c} size={44} />
              <figcaption>
                <code>{c}</code>
                <span>accent tile</span>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Preview />
  </StrictMode>,
);
