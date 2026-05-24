'use client'

/**
 * BodyDiagram.tsx
 * Sabbath Spa & Wellness Hub — Interactive Body Target Selector
 *
 * Features
 * ─────────
 * · Front / Back toggle — both views share the same zone keys so
 *   selecting "Arms" on the front automatically highlights them on
 *   the back too.
 * · 11 clickable zones: Head, Neck, Shoulders, Upper Back (Chest on
 *   front), Lower Back (Abdomen on front), Glutes, Arms, Hands,
 *   Thighs, Calves, Feet.
 * · Controlled via selectedParts / onChange props — drop into any
 *   React form as-is.
 * · Fully accessible: role="button", aria-pressed, keyboard support.
 * · Tailwind v4 utility classes for layout; brand tokens inline for
 *   SVG fills.
 *
 * Usage
 * ─────
 *   <BodyDiagram
 *     selectedParts={parts}
 *     onChange={setParts}
 *   />
 */

import { useState, useCallback, useRef, useEffect } from 'react'

// ─────────────────────────────────────────────────────────────
// BRAND TOKENS
// ─────────────────────────────────────────────────────────────
const T = {
    gold: '#C58F3B',
    goldStroke: '#9A6E28',
    goldHover: 'rgba(197,143,59,0.28)',
    unselFill: 'rgba(26,26,26,0.07)',
    unselStroke: 'rgba(26,26,26,0.35)',
    bg: '#F9F4EB',
    black: '#1A1A1A',
    body: "'Inter', system-ui, sans-serif",
    display: "'Cormorant Garamond', Georgia, serif",
} as const

// ─────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────
export interface BodyDiagramProps {
    /** Array of currently selected zone keys */
    selectedParts: string[]
    /** Called with the updated array whenever a zone is toggled */
    onChange: (parts: string[]) => void
    /** Optional CSS class applied to the root wrapper */
    className?: string
}

interface ZoneDef {
    key: string
    frontLabel: string   // label shown when front view is active
    backLabel: string   // label shown when back view is active
    chipLabel: string   // label used in the selection chip strip
    /** One or more SVG <path d="…"> strings for the front figure */
    frontPaths: string[]
    /** One or more SVG <path d="…"> strings for the back figure */
    backPaths: string[]
}

// ─────────────────────────────────────────────────────────────
// ZONE DEFINITIONS
// viewBox="0 0 140 384"  ·  center-x=70
//
// Design rules
// ────────────
// · Adjacent zones share an edge (±2 px overlap) → no dead click zones.
// · Left + right limbs use the SAME key so they select as one unit.
// · SVG draw order: torso first, limbs on top — so limb clicks always win.
// · All coordinates verified to stay within 0–140 × 0–384.
// ─────────────────────────────────────────────────────────────
const ZONES: ZoneDef[] = [

    // ── 1. HEAD ────────────────────────────────────────────────
    {
        key: 'head',
        frontLabel: 'Head',
        backLabel: 'Head',
        chipLabel: 'Head',
        // Oval: top y=4, bottom y=60, spans x=40..100
        frontPaths: [
            'M 70,4 C 94,4 102,18 102,36 C 102,54 92,62 70,62 C 48,62 38,54 38,36 C 38,18 46,4 70,4 Z',
        ],
        backPaths: [
            'M 70,4 C 94,4 102,18 102,36 C 102,54 92,62 70,62 C 48,62 38,54 38,36 C 38,18 46,4 70,4 Z',
        ],
    },

    // ── 2. NECK ────────────────────────────────────────────────
    {
        key: 'neck',
        frontLabel: 'Neck',
        backLabel: 'Neck',
        chipLabel: 'Neck',
        // Tapered column: x=62..78, y=60..80
        frontPaths: [
            'M 62,60 C 60,66 60,74 62,80 L 78,80 C 80,74 80,66 78,60 Z',
        ],
        backPaths: [
            'M 62,60 C 60,66 60,74 62,80 L 78,80 C 80,74 80,66 78,60 Z',
        ],
    },

    // ── 3. SHOULDERS ───────────────────────────────────────────
    {
        key: 'shoulders',
        frontLabel: 'Shoulders',
        backLabel: 'Shoulders',
        chipLabel: 'Shoulders',
        // Trapezoid: narrows from outer span (x=8..132) to torso top (x=28..112)
        // y: 78 (neck base) → 116 (armpit / torso top)
        frontPaths: [
            `M 62,78
       C 46,80 28,88 14,100 L 8,116 L 28,118
       C 32,104 46,96 62,90 L 78,90
       C 94,96 108,104 112,118 L 132,116 L 126,100
       C 112,88 94,80 78,78 Z`,
        ],
        backPaths: [
            `M 62,78
       C 46,80 28,88 14,100 L 8,116 L 28,118
       C 32,104 46,96 62,90 L 78,90
       C 94,96 108,104 112,118 L 132,116 L 126,100
       C 112,88 94,80 78,78 Z`,
        ],
    },

    // ── 4. UPPER BACK / CHEST ──────────────────────────────────
    {
        key: 'upper_back',
        frontLabel: 'Chest',
        backLabel: 'Upper Back',
        chipLabel: 'Chest / Upper Back',
        // Torso upper section: armpit → waist
        // Front: slight waist taper with pectoral curve
        frontPaths: [
            `M 28,116
       C 26,136 24,156 26,170
       L 114,170
       C 116,156 114,136 112,116 Z`,
        ],
        // Back: same rectangle — different label, same shape
        backPaths: [
            `M 28,116
       C 26,136 24,156 26,170
       L 114,170
       C 116,156 114,136 112,116 Z`,
        ],
    },

    // ── 5. LOWER BACK / ABDOMEN ────────────────────────────────
    {
        key: 'lower_back',
        frontLabel: 'Abdomen',
        backLabel: 'Lower Back',
        chipLabel: 'Lower Back / Abdomen',
        // Front: widens at hips to cover pelvic bridge between legs
        frontPaths: [
            `M 26,170
       C 24,190 22,208 22,214
       C 22,226 32,234 50,236 L 70,238 L 90,236
       C 108,234 118,226 118,214
       C 118,208 116,190 114,170 Z`,
        ],
        // Back: clean rectangle (lumbar region only; glutes covers the hip curve)
        backPaths: [
            `M 26,170
       C 24,188 22,204 22,210
       L 118,210
       C 118,204 116,188 114,170 Z`,
        ],
    },

    // ── 6. GLUTES (back only) ──────────────────────────────────
    {
        key: 'glutes',
        frontLabel: '',       // not rendered on front
        backLabel: 'Glutes',
        chipLabel: 'Glutes',
        frontPaths: [],       // intentionally empty
        backPaths: [
            // Rounded trapezoid at hip level; protrudes outward in back view
            `M 20,208
       C 10,226 8,252 18,270 L 70,278 L 122,270
       C 132,252 130,226 120,208 Z`,
        ],
    },

    // ── 7. ARMS (left + right combined) ────────────────────────
    {
        key: 'arms',
        frontLabel: 'Arms',
        backLabel: 'Arms',
        chipLabel: 'Arms',
        frontPaths: [
            // Left arm: outer edge x=8, inner edge x=28; y=116..244
            // Tapers slightly toward wrist
            'M 8,116 L 4,244 L 24,246 L 28,118 Z',
            // Right arm: mirror
            'M 112,118 L 116,246 L 136,244 L 132,116 Z',
        ],
        backPaths: [
            'M 8,116 L 4,244 L 24,246 L 28,118 Z',
            'M 112,118 L 116,246 L 136,244 L 132,116 Z',
        ],
    },

    // ── 8. HANDS (left + right combined) ───────────────────────
    {
        key: 'hands',
        frontLabel: 'Hands',
        backLabel: 'Hands',
        chipLabel: 'Hands',
        frontPaths: [
            // Left hand: small teardrop below left wrist
            'M 2,244 C 0,256 2,266 8,268 C 14,270 22,266 22,258 L 22,246 L 4,244 Z',
            // Right hand: mirror
            'M 116,246 L 116,258 C 116,266 124,270 130,268 C 136,266 138,256 136,244 Z',
        ],
        backPaths: [
            'M 2,244 C 0,256 2,266 8,268 C 14,270 22,266 22,258 L 22,246 L 4,244 Z',
            'M 116,246 L 116,258 C 116,266 124,270 130,268 C 136,266 138,256 136,244 Z',
        ],
    },

    // ── 9. THIGHS (left + right combined) ──────────────────────
    {
        key: 'thighs',
        frontLabel: 'Thighs',
        backLabel: 'Thighs',
        chipLabel: 'Thighs',
        frontPaths: [
            // Left thigh: x=22..54, y=232..316
            'M 22,232 L 16,316 L 46,316 L 52,232 Z',
            // Right thigh: x=88..118, y=232..316
            'M 88,232 L 92,316 L 122,316 L 118,232 Z',
        ],
        // Back thighs start lower (below glutes, y≈272)
        backPaths: [
            'M 18,272 L 12,316 L 44,316 L 50,272 Z',
            'M 90,272 L 96,316 L 128,316 L 122,272 Z',
        ],
    },

    // ── 10. CALVES (left + right combined) ─────────────────────
    {
        key: 'calves',
        frontLabel: 'Calves',
        backLabel: 'Calves',
        chipLabel: 'Calves',
        frontPaths: [
            'M 16,316 L 12,368 L 44,368 L 46,316 Z',
            'M 92,316 L 94,368 L 126,368 L 122,316 Z',
        ],
        backPaths: [
            'M 12,316 L 8,368 L 42,368 L 44,316 Z',
            'M 96,316 L 98,368 L 130,368 L 128,316 Z',
        ],
    },

    // ── 11. FEET (left + right combined) ───────────────────────
    {
        key: 'feet',
        frontLabel: 'Feet',
        backLabel: 'Feet',
        chipLabel: 'Feet',
        frontPaths: [
            // Left foot: extends forward (left in SVG)
            'M 8,368 L 4,380 L 48,380 L 44,368 Z',
            // Right foot: extends forward (right)
            'M 94,368 L 90,380 L 136,380 L 126,368 Z',
        ],
        backPaths: [
            'M 4,368 L 0,380 L 44,380 L 42,368 Z',
            'M 98,368 L 94,380 L 138,380 L 128,368 Z',
        ],
    },
]

// Zone render order: draw torso first, then limbs on top so limb
// clicks always win over torso clicks near boundaries.
const FRONT_RENDER_ORDER = [
    'upper_back', 'lower_back',
    'shoulders',
    'thighs', 'calves', 'feet',
    'arms', 'hands',
    'neck', 'head',
]
const BACK_RENDER_ORDER = [
    'upper_back', 'lower_back', 'glutes',
    'shoulders',
    'thighs', 'calves', 'feet',
    'arms', 'hands',
    'neck', 'head',
]

// ─────────────────────────────────────────────────────────────
// HELPER: build a lookup map keyed by zone key
// ─────────────────────────────────────────────────────────────
const ZONE_MAP = Object.fromEntries(ZONES.map(z => [z.key, z]))

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function BodyDiagram({
    selectedParts,
    onChange,
    className = '',
}: BodyDiagramProps) {
    const [view, setView] = useState<'front' | 'back'>('front')
    const [hoveredKey, setHoveredKey] = useState<string | null>(null)
    const svgRef = useRef<SVGSVGElement>(null)

    const renderOrder = view === 'front' ? FRONT_RENDER_ORDER : BACK_RENDER_ORDER

    // ── Toggle a zone in/out of selectedParts ──────────────────
    const toggle = useCallback((key: string) => {
        onChange(
            selectedParts.includes(key)
                ? selectedParts.filter(k => k !== key)
                : [...selectedParts, key],
        )
    }, [selectedParts, onChange])

    // ── Keyboard handler on SVG paths ─────────────────────────
    const handleKeyDown = useCallback((e: React.KeyboardEvent, key: string) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            toggle(key)
        }
    }, [toggle])

    // ── Click label for current view ──────────────────────────
    function zoneLabel(key: string) {
        const z = ZONE_MAP[key]
        if (!z) return key
        return view === 'front' ? z.frontLabel : z.backLabel
    }

    // ── Zones visible in current view ─────────────────────────
    const visibleZones = renderOrder
        .map(key => ZONE_MAP[key])
        .filter(z => {
            const paths = view === 'front' ? z.frontPaths : z.backPaths
            return paths.length > 0
        })

    return (
        <div className={`flex flex-col gap-5 w-full select-none ${className}`}>

            {/* ── VIEW TOGGLE ─────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
                <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
                    textTransform: 'uppercase', color: T.gold, fontFamily: T.body,
                }}>
                    Body Map
                </span>

                <div style={{
                    display: 'inline-flex',
                    backgroundColor: 'rgba(26,26,26,0.06)',
                    borderRadius: 10, padding: 3,
                    border: `1px solid rgba(26,26,26,0.10)`,
                }}>
                    {(['front', 'back'] as const).map(v => (
                        <button
                            key={v}
                            type="button"
                            onClick={() => setView(v)}
                            style={{
                                padding: '6px 20px',
                                borderRadius: 8, border: 'none',
                                cursor: 'pointer',
                                fontSize: 12, fontWeight: 600,
                                fontFamily: T.body,
                                letterSpacing: '0.08em',
                                textTransform: 'uppercase',
                                transition: 'all 180ms ease',
                                backgroundColor: view === v ? T.black : 'transparent',
                                color: view === v ? T.gold : 'rgba(26,26,26,0.42)',
                                boxShadow: view === v ? '0 1px 4px rgba(0,0,0,0.18)' : 'none',
                            }}
                            aria-pressed={view === v}
                            aria-label={`Show ${v} view`}
                        >
                            {v === 'front' ? '↑ Front' : '↓ Back'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── SVG DIAGRAM ─────────────────────────────────────── */}
            <div className="flex flex-col items-center gap-1">
                <svg
                    ref={svgRef}
                    viewBox="0 0 140 384"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full"
                    style={{ maxWidth: 240, height: 'auto', display: 'block' }}
                    aria-label={`${view} body diagram — click zones to select target areas`}
                    role="group"
                >
                    {/* Subtle body outline background — unifies the figure visually */}
                    <rect
                        x="0" y="0" width="140" height="384"
                        fill="none"
                    />

                    {/* Zone paths */}
                    {visibleZones.map(zone => {
                        const paths = view === 'front' ? zone.frontPaths : zone.backPaths
                        const isSelected = selectedParts.includes(zone.key)
                        const isHovered = hoveredKey === zone.key
                        const label = zoneLabel(zone.key)

                        return paths.map((d, i) => (
                            <path
                                key={`${zone.key}-${i}`}
                                d={d}
                                fill={
                                    isSelected ? T.gold
                                        : isHovered ? T.goldHover
                                            : T.unselFill
                                }
                                stroke={isSelected ? T.goldStroke : T.unselStroke}
                                strokeWidth={isSelected ? 1.4 : 0.8}
                                strokeLinejoin="round"
                                style={{
                                    cursor: 'pointer',
                                    transition: 'fill 160ms ease, stroke 160ms ease',
                                    outline: 'none',
                                }}
                                role="button"
                                tabIndex={i === 0 ? 0 : -1}   // only first path in group is focusable
                                aria-label={`${label}${isSelected ? ' — selected, press to deselect' : ' — press to select'}`}
                                aria-pressed={isSelected}
                                onClick={() => toggle(zone.key)}
                                onKeyDown={e => handleKeyDown(e, zone.key)}
                                onMouseEnter={() => setHoveredKey(zone.key)}
                                onMouseLeave={() => setHoveredKey(null)}
                                onFocus={() => setHoveredKey(zone.key)}
                                onBlur={() => setHoveredKey(null)}
                            />
                        ))
                    })}
                </svg>

                {/* Hover / focus label */}
                <div style={{ height: 18, textAlign: 'center' }}>
                    {hoveredKey && ZONE_MAP[hoveredKey] && (
                        <span style={{
                            fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
                            textTransform: 'uppercase', color: T.gold, fontFamily: T.body,
                        }}>
                            {zoneLabel(hoveredKey)}
                        </span>
                    )}
                </div>
            </div>

            {/* ── ZONE PICKER (text alternative + quick select) ─────── */}
            <div>
                <p style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                    textTransform: 'uppercase', color: 'rgba(26,26,26,0.38)',
                    fontFamily: T.body, marginBottom: 8,
                }}>
                    Or tap to select
                </p>
                <div className="flex flex-wrap gap-2">
                    {ZONES.map(zone => {
                        // Skip glutes on front picker to avoid confusion
                        if (view === 'front' && zone.frontPaths.length === 0) return null
                        const isSelected = selectedParts.includes(zone.key)
                        const label = view === 'front' ? zone.frontLabel : zone.backLabel
                        return (
                            <button
                                key={zone.key}
                                type="button"
                                onClick={() => toggle(zone.key)}
                                style={{
                                    padding: '5px 14px',
                                    borderRadius: 99,
                                    border: `1px solid ${isSelected ? T.goldStroke : 'rgba(26,26,26,0.15)'}`,
                                    backgroundColor: isSelected ? T.gold : 'rgba(26,26,26,0.05)',
                                    color: isSelected ? T.black : 'rgba(26,26,26,0.55)',
                                    fontSize: 12,
                                    fontWeight: 500,
                                    fontFamily: T.body,
                                    cursor: 'pointer',
                                    transition: 'all 160ms ease',
                                }}
                                aria-pressed={isSelected}
                            >
                                {label}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* ── SELECTED CHIPS ───────────────────────────────────── */}
            {selectedParts.length > 0 ? (
                <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                        <p style={{
                            fontSize: 10, fontWeight: 600, letterSpacing: '0.14em',
                            textTransform: 'uppercase', color: T.gold, fontFamily: T.body, margin: 0,
                        }}>
                            Selected · {selectedParts.length}
                        </p>
                        <button
                            type="button"
                            onClick={() => onChange([])}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                fontSize: 10, fontWeight: 600, letterSpacing: '0.10em',
                                textTransform: 'uppercase', color: 'rgba(26,26,26,0.35)',
                                fontFamily: T.body, padding: '2px 0',
                            }}
                        >
                            Clear all
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {selectedParts.map(key => {
                            const zone = ZONE_MAP[key]
                            if (!zone) return null
                            return (
                                <button
                                    key={key}
                                    type="button"
                                    onClick={() => toggle(key)}
                                    style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '5px 14px', borderRadius: 99,
                                        backgroundColor: T.gold, color: T.black,
                                        border: `1px solid ${T.goldStroke}`,
                                        fontSize: 12, fontWeight: 600,
                                        fontFamily: T.body, cursor: 'pointer',
                                        transition: 'background-color 150ms ease, opacity 150ms ease',
                                    }}
                                    onMouseEnter={e => (e.currentTarget.style.opacity = '0.80')}
                                    onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                    aria-label={`Remove ${zone.chipLabel}`}
                                >
                                    {zone.chipLabel}
                                    <span aria-hidden="true" style={{ fontSize: 14, lineHeight: 1, marginTop: -1 }}>×</span>
                                </button>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <p style={{
                    textAlign: 'center', fontSize: 12,
                    color: 'rgba(26,26,26,0.32)', fontFamily: T.body,
                    fontStyle: 'italic', margin: 0,
                }}>
                    Tap a zone on the diagram or use the buttons above
                </p>
            )}
        </div>
    )
}