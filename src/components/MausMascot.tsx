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

/** Eye geometry, in the 259-unit body space. */
const EYE = {
  left: { x: 84, y: 92, rx: 11 },
  right: { x: 145, y: 92, rx: 11 },
};
const EYE_OPEN_RY = 17;

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
        Math.sin((now / period) * Math.PI * 2 + phase) * motion.amplitude * 2.6;
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
          {(["left", "right"] as const).map((side) => (
            <ellipse
              key={side}
              cx={EYE[side].x}
              cy={EYE[side].y}
              rx={EYE[side].rx}
              ry={state === "sleeping" ? 2.5 : EYE_OPEN_RY}
            />
          ))}
        </g>
      </g>
    </svg>
  );
}

export const MausMascot = memo(MausMascotComponent);
