/**
 * Unit: lib/sound - WebAudio UI sound engine.
 *
 * jsdom has no WebAudio, so we stub AudioContext with spy oscillator/gain nodes
 * and assert playSound wires a graph for every sound type (and never throws).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { playSound, type SoundType } from "@/lib/sound";

const oscillators: any[] = [];

function makeCtx() {
    return {
        state: "running",
        currentTime: 0,
        resume: vi.fn(),
        destination: {},
        createOscillator: vi.fn(() => {
            const osc = {
                type: "sine",
                frequency: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
                connect: vi.fn(),
                start: vi.fn(),
                stop: vi.fn(),
            };
            oscillators.push(osc);
            return osc;
        }),
        createGain: vi.fn(() => ({
            gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
            connect: vi.fn(),
        })),
    };
}

beforeEach(() => {
    oscillators.length = 0;
    (globalThis as any).window = globalThis;
    (globalThis as any).AudioContext = vi.fn(makeCtx);
});

const TYPES: SoundType[] = [
    "create", "delete", "move", "add", "check", "uncheck",
    "hover", "click", "toast", "toast-error", "navigate",
];

describe("playSound", () => {
    it("wires an oscillator graph for every sound type without throwing", () => {
        for (const t of TYPES) {
            oscillators.length = 0;
            expect(() => playSound(t)).not.toThrow();
            expect(oscillators.length).toBeGreaterThan(0);
        }
    });

    it("throttles rapid hover blips (second call within 80ms is skipped)", () => {
        oscillators.length = 0;
        playSound("hover");
        const afterFirst = oscillators.length;
        playSound("hover"); // immediate second call -> throttled
        expect(oscillators.length).toBe(afterFirst);
    });

    it("never throws when WebAudio is unavailable", () => {
        delete (globalThis as any).AudioContext;
        expect(() => playSound("click")).not.toThrow();
    });
});
