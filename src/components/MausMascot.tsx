// The animated bot avatar: drawn character bodies, moved by our own motion
// table (lib/mascot-motion) with the face painted on at runtime.
//
// The split is what makes both halves work. The artwork carries identity — ten
// distinct silhouettes, so a bot is recognisable at a glance — and identity
// does not change. The face carries mood, which changes every turn, so it is
// drawn over the art rather than baked into it. Baking it would mean one file
// per colour per mood, ten by thirty-nine, and would still animate worse.
//
// The loop writes two SVG transform attributes per frame and never touches
// React state — a sidebar of thirty bots would otherwise re-render thirty
// component trees sixty times a second to move a shape four pixels.
import { memo, useEffect, useRef } from "react";
import { type MausColor } from "@/lib/colors";
import { ART_SIZE, EYE, EYE_INK, VISOR, VISOR_INK, artFor } from "@/lib/mascot-art";
import { motionFor, timingFor, type MausState } from "@/lib/mascot-motion";

/**
 * How far the body travels, as a multiple of the table's amplitude.
 *
 * The table is authored in small units — a working bot moves about two of
 * them. Across a 384-unit body that is under a pixel in a 36px sidebar row,
 * which reads as nothing at all, so the travel is scaled until it survives the
 * sizes avatars are actually drawn at.
 */
const BOB_SCALE = 9;

const prefersReducedMotion = () =>
  typeof window !== "undefined"
  && typeof window.matchMedia === "function"
  && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface MausMascotProps {
  color: MausColor;
  state?: MausState;
  size?: number;
  /** Stable per-bot seed, so two bots never breathe in unison. */
  seed?: string;
  paused?: boolean;
  title?: string;
  className?: string;
}

function MausMascotComponent({
  color,
  state = "idle",
  size = 44,
  seed = "",
  paused = false,
  title,
  className,
}: MausMascotProps) {
  const bodyRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);
  const identity = seed || color;
  const centre = ART_SIZE / 2;

  useEffect(() => {
    const body = bodyRef.current;
    const eyes = eyesRef.current;
    if (!body || !eyes) return;

    const motion = motionFor(state);
    const { phase, rate } = timingFor(identity);
    // Scaling about the eyes' own centre line, so a narrowing eye closes
    // towards the middle rather than sliding up the visor.
    const eyeScale = `translate(0 ${EYE.cy}) scale(1 ${motion.eye}) translate(0 ${-EYE.cy})`;

    // Reduced motion still gets the pose — the lean and the eyes carry most of
    // the meaning, and holding them still is the honest reading of it.
    if (paused || prefersReducedMotion() || motion.amplitude === 0) {
      body.setAttribute("transform", `rotate(${motion.tilt} ${centre} ${centre})`);
      eyes.setAttribute("transform", eyeScale);
      return;
    }

    const period = motion.period * rate;
    let frame = 0;
    const tick = (now: number) => {
      const bob = Math.sin((now / period) * Math.PI * 2 + phase) * motion.amplitude * BOB_SCALE;
      body.setAttribute(
        "transform",
        `translate(0 ${(-bob).toFixed(2)}) rotate(${motion.tilt} ${centre} ${centre})`,
      );
      eyes.setAttribute("transform", eyeScale);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [centre, identity, paused, state]);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={`0 0 ${ART_SIZE} ${ART_SIZE}`}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-maus-state={state}
      style={{ display: "block", flexShrink: 0, overflow: "visible", userSelect: "none" }}
    >
      <g ref={bodyRef}>
        <image href={artFor(color)} x="0" y="0" width={ART_SIZE} height={ART_SIZE} />
        {/* The drawing has a face already. Painting the visor back over it is
            what frees the expression to be ours: without this the drawn eyes
            would show through whatever mood the bot is actually in. */}
        <rect
          x={VISOR.x}
          y={VISOR.y}
          width={VISOR.width}
          height={VISOR.height}
          rx={VISOR.radius}
          fill={VISOR_INK}
        />
        <g ref={eyesRef} fill={EYE_INK[color] ?? EYE_INK.green}>
          {([-1, 1] as const).map((side) => (
            <rect
              key={side}
              x={VISOR.x + VISOR.width / 2 + side * EYE.dx - EYE.width / 2}
              y={EYE.cy - EYE.height / 2}
              width={EYE.width}
              height={EYE.height}
              rx={EYE.width / 2}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

export const MausMascot = memo(MausMascotComponent);
