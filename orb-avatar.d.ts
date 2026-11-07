// Type definitions for <orb-avatar>.

export type OrbBuiltInReaction =
  | 'idle' | 'happy' | 'thinking' | 'working' | 'done' | 'needs'
  | 'sleeping' | 'error' | 'love' | 'sad' | 'dizzy' | 'wink';

/** A built-in reaction, or any name registered with `OrbAvatar.defineReaction`. */
export type OrbReaction = OrbBuiltInReaction | (string & {});

/** Where the orb looks: `drift` sways, `follow` tracks the cursor, `wander` glances around, `fixed` holds `gaze`. */
export type OrbMode = 'drift' | 'follow' | 'wander' | 'fixed';

/** Reaction shown briefly after a poke. Escalates with rapid pokes. */
export type OrbPokeReaction = 'surprised' | 'giggle' | 'dizzy';

export type OrbExtra = 'dots' | 'zzz' | 'sparkle' | 'heart' | 'sweat' | 'stars' | 'ring'
  | 'notes' | 'spray' | 'hic' | 'boo' | 'knock' | 'huh' | 'bulb' | 'fly' | 'bubble' | 'bang';

export type OrbBuiltInEmote = 'yawn' | 'shifty' | 'sneeze' | 'hiccup' | 'whistle' | 'cheeky' | 'vibe'
  | 'peekaboo' | 'boop' | 'derp' | 'idea' | 'fly' | 'bubble' | 'doze' | 'wake';
export type OrbEmote = OrbBuiltInEmote | (string & {});

/** A point in face space: `a` to the right, `b` up, in sphere radii. */
export type OrbPoint = [a: number, b: number];

export interface OrbFeature {
  /** Slot name. Shapes in the same slot morph into each other: L, R, hL, hR, h2L, h2R, bL, bR, tear, or your own. */
  key: string;
  /** Closed outline in face space. */
  pts: OrbPoint[];
  /** Center, used for blinking and pop-in scaling. */
  c: OrbPoint;
  /** Palette name ('eye' | 'hi' | 'blush' | 'tear' | 'spark' | 'color') or any CSS color. */
  fill?: string;
  /** Opacity, 0 to 1. */
  op?: number;
  /** When true, the shape does not squash during blinks. */
  fixed?: boolean;
  /** Vertical center to blink around, when it differs from `c`. */
  bc?: number;
}

export interface OrbMotion {
  /** Look direction in radians, blended with the current mode by `w` (0 to 1). */
  yaw?: number;
  pitch?: number;
  w?: number;
  /** Head tilt in radians. */
  roll?: number;
  /** Fast offsets added after smoothing, for shakes and sways. */
  rollAdd?: number;
  yawAdd?: number;
  /** Vertical offset in ball radii. Negative is up (hops). */
  dy?: number;
  /** Uniform scale. */
  s?: number;
}

export interface OrbReactionDef {
  label?: string;
  /** Blink every few seconds while this reaction is showing. */
  blink?: boolean;
  /** Hide from `OrbAvatar.reactions`. */
  hidden?: boolean;
  /** Return the face. Declare no parameter for a static face (it is cached); take `t` for animated faces. */
  feats: (t: number, e: number) => OrbFeature[];
  /** Movement. `t` is seconds; `e` is seconds since the current poke reaction or emote started. */
  motion?: ((t: number, e: number) => OrbMotion) | null;
  extra?: OrbExtra;
}

export interface OrbEmoteDef extends OrbReactionDef {
  /** Seconds. */
  duration?: number;
  /** How often alive orbs pick it, relative to other emotes. 0 = never at random. */
  weight?: number;
  /** Jiggles at given times: [seconds, strength]. */
  kicks?: [number, number][];
}

export interface OrbShapes {
  F(key: string, pts: OrbPoint[], c: OrbPoint, fill?: string, opts?: Partial<OrbFeature>): OrbFeature;
  /** Horizontal eye offset and vertical eye line used by the built-in faces. */
  X: number;
  Y: number;
  /** Rounded tall eye. `side` is -1 (left) or 1 (right). */
  capEye(side: -1 | 1, h?: number, w?: number, y?: number): OrbFeature;
  /** Eye with an eyelid cut along the line p→q. */
  lidEye(side: -1 | 1, h: number, y: number, p: OrbPoint, q: OrbPoint): OrbFeature;
  /** Closed happy eye: ^ */
  arcEye(side: -1 | 1): OrbFeature;
  /** Two cheek blush ovals. */
  blush(): OrbFeature[];
  superE(cx: number, cy: number, w: number, h: number, n?: number, N?: number): OrbPoint[];
  ell(cx: number, cy: number, rx: number, ry: number, N?: number): OrbPoint[];
  qb(a: OrbPoint, b: OrbPoint, c: OrbPoint, N?: number): OrbPoint[];
  polyline(pts: OrbPoint[], N?: number): OrbPoint[];
  /** Turn an open line into a closed, round-capped outline of width w. */
  stroke(pts: OrbPoint[], w: number): OrbPoint[];
  clipBelow(shape: OrbPoint[], p: OrbPoint, q: OrbPoint): OrbPoint[];
  heart(cx: number, cy: number, size: number, N?: number): OrbPoint[];
  drop(cx: number, cy: number, r: number, N?: number): OrbPoint[];
  hop(t: number, period: number, duration: number, height: number): OrbMotion;
}

export interface OrbReactionChangeDetail { from: OrbReaction; to: OrbReaction; }
export interface OrbPokeDetail { count: number; reaction: OrbPokeReaction; }
export interface OrbEmoteDetail { name: OrbEmote; }

export declare class OrbAvatar extends HTMLElement {
  /** Current base reaction (pokes do not change it). */
  reaction: OrbReaction;
  mode: OrbMode;
  react(name: OrbReaction): this;
  /** Jiggle the ball. With `react` (default true) it also plays a poke reaction. */
  poke(force?: number, options?: { react?: boolean }): this;
  spin(): this;
  blink(): this;
  /** Look at a point in client (viewport) pixels. Call with no arguments to release. */
  lookAt(x?: number, y?: number): this;
  /** Play an emote now. */
  emote(name: OrbEmote): this;
  /** Doze off and sleep until poked, approached or given a new reaction. */
  sleep(): this;
  wakeUp(): this;
  readonly asleep: boolean;
  /** Static SVG markup of the current face on a round body. */
  toSVG(options?: { size?: number }): string;

  static readonly reactions: OrbReaction[];
  static reactionLabel(name: OrbReaction): string;
  static defineReaction(name: string, def: OrbReactionDef): void;
  static readonly emotes: OrbEmote[];
  static defineEmote(name: string, def: OrbEmoteDef): void;
  static shapes: OrbShapes;
  /** 'auto' adapts to the device; 0 = full, 1 = lighter, 2 = lightest. */
  static quality: 'auto' | 0 | 1 | 2;
  static readonly qualityLevel: 0 | 1 | 2;
}

declare global {
  interface Window { OrbAvatar: typeof OrbAvatar; }
  interface HTMLElementTagNameMap { 'orb-avatar': OrbAvatar; }
  interface HTMLElementEventMap {
    reactionchange: CustomEvent<OrbReactionChangeDetail>;
    poke: CustomEvent<OrbPokeDetail>;
    emote: CustomEvent<OrbEmoteDetail>;
  }
}

