// The animated bot avatar: our motion table (lib/mascot-motion) driving the
// shape constructors in lib/mascot-shapes.
//
// NOTE: lib/mascot-shapes is third-party derived and carries a do-not-publish
// header. The loop, the coefficient table and the per-bot timing here are ours;
// swapping that one import for original artwork is all it takes to make this
// component publishable again.
//
// The loop writes two SVG transform attributes per frame and never touches
// React state — a sidebar of thirty bots would otherwise re-render thirty
// component trees sixty times a second to move a shape four pixels.
import { memo, useEffect, useId, useRef } from "react";
import { type MausColor } from "@/lib/colors";
import { motionFor, timingFor, type MausState } from "@/lib/mascot-motion";
import {
  CENTER,
  PERSONA_COLORS,
  VIEWBOX,
  personaShapePath,
  resolvePersonaShape,
} from "@/lib/mascot-shapes";

/** Eye geometry, in the 259-unit body space, matching the shipped artifact. */
const EYE_DX = 29;
const EYE_DY = -8;
const EYE_RX = 10;
const EYE_OPEN_RY = 7;
const EYE_SHUT_RY = 2;

/**
 * How far the body actually travels, as a multiple of the table's amplitude.
 *
 * The table is authored in the same small units the artifact uses, where a
 * working bot moves two units out of a 259-unit box. At the size the original
 * draws its character that reads as breathing; in a 36px sidebar row it is
 * three quarters of one pixel, which reads as nothing at all. Avatars here are
 * small almost everywhere, so the travel is scaled up until it survives them.
 */
const BOB_SCALE = 6;

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export interface MausMascotProps {
  color: MausColor;
  state?: MausState;
  size?: number;
  /** Stable per-bot seed: picks the body shape and keeps bots out of step. */
  seed?: string;
  /** Force a body shape; otherwise it is derived from `seed`. */
  shape?: string;
  paused?: boolean;
  title?: string;
  className?: string;
}

function MausMascotComponent({
  color,
  state = "idle",
  size = 44,
  seed = "",
  shape,
  paused = false,
  title,
  className,
}: MausMascotProps) {
  const id = useId().replace(/:/g, "");
  const bodyRef = useRef<SVGGElement>(null);
  const eyesRef = useRef<SVGGElement>(null);

  const identity = seed || color;
  const path = personaShapePath(shape ?? resolvePersonaShape(identity));
  const ink = PERSONA_COLORS[color] ?? PERSONA_COLORS.green;

  useEffect(() => {
    const body = bodyRef.current;
    const eyes = eyesRef.current;
    if (!body || !eyes) return;

    const motion = motionFor(state);
    const { phase, rate } = timingFor(identity);
    const eyeScale = `translate(0 ${CENTER}) scale(1 ${motion.eye}) translate(0 ${-CENTER})`;

    // Reduced motion still gets the pose — the eyes and the lean carry most of
    // the meaning, and holding them still is the honest reading of it.
    if (paused || prefersReducedMotion() || motion.amplitude === 0) {
      body.setAttribute(
        "transform",
        `rotate(${motion.tilt} ${CENTER} ${CENTER})`,
      );
      eyes.setAttribute("transform", eyeScale);
      return;
    }

    const period = motion.period * rate;
    let frame = 0;
    const tick = (now: number) => {
      const bob =
        Math.sin((now / period) * Math.PI * 2 + phase) *
        motion.amplitude *
        BOB_SCALE;
      body.setAttribute(
        "transform",
        `translate(0 ${(-bob).toFixed(2)}) rotate(${motion.tilt} ${CENTER} ${CENTER})`,
      );
      eyes.setAttribute("transform", eyeScale);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [identity, paused, state]);

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox={VIEWBOX}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      data-maus-state={state}
      style={{
        display: "block",
        flexShrink: 0,
        overflow: "visible",
        userSelect: "none",
      }}
    >
      <defs>
        <linearGradient id={`${id}-ink`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={ink.light} />
          <stop offset="1" stopColor={ink.dark} />
        </linearGradient>
      </defs>
      <g ref={bodyRef}>
        <path d={path} fill={`url(#${id}-ink)`} />
        <g ref={eyesRef} fill="rgba(0,0,0,0.82)">
          {([-1, 1] as const).map((side) => (
            <ellipse
              key={side}
              cx={CENTER + side * EYE_DX}
              cy={CENTER + EYE_DY}
              rx={EYE_RX}
              ry={state === "sleeping" ? EYE_SHUT_RY : EYE_OPEN_RY}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

export const MausMascot = memo(MausMascotComponent);
