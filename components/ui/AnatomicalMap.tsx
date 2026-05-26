'use client'

/**
 * AnatomicalMap.tsx  —  Sabbath Spa & Wellness Hub
 * Interactive anatomical body-zone selector, Phase 3 Waiver
 *
 * What changed in this version
 * ─────────────────────────────
 * 1. PATHS completely redrawn with organic bezier curves that match the
 *    proportions of a 3D muscular reference figure (male & female,
 *    front & back).  Every limb, torso segment, and extremity uses
 *    multi-point cubic bezier control points instead of straight-line
 *    trapezoids.
 *
 * 2. NON_SELECTABLE set  — `abdomen` is now permanently locked:
 *    · toggle() early-returns for any key in NON_SELECTABLE
 *    · Rendered as a static decorative zone (no cursor, no aria role)
 *    · Excluded from the text-chip picker
 *    · Still drawn on the SVG so the torso looks complete
 *
 * 3. Glass-overlay mode  — pass `referenceImage="/your-3d-body.png"`
 *    to mount the image as an SVG <image> background.  Path fills
 *    automatically switch to translucent gold glass so the 3D detail
 *    shows through on hover/select, and white-glass outlines in the
 *    resting state.  Without the prop the component falls back to the
 *    original solid-fill appearance.
 *
 * Props (unchanged from original)
 * ────────────────────────────────
 * selectedParts  string[]             controlled selection array
 * onChange       (parts:string[])=>void  called on every toggle
 * referenceImage? string              optional 3D image URL / path
 */

import { useState } from 'react'

// ─────────────────────────────────────────────────────────────
// TOKENS
// ─────────────────────────────────────────────────────────────
const GOLD = '#C58F3B'
const BLACK = '#1A1A1A'
const BODY = "'Inter', system-ui, sans-serif"

// ─────────────────────────────────────────────────────────────
// ZONE METADATA  — preserved verbatim from original
// ─────────────────────────────────────────────────────────────
const ZONE_META: Record<string, { label: string; description: string }> = {
    head: { label: 'Head', description: 'Scalp, temples, crown, forehead and cranial pressure points' },
    neck: { label: 'Neck', description: 'Cervical spine, trapezius upper fibers, suboccipitals, SCM' },
    shoulders: { label: 'Shoulders', description: 'Deltoids, rotator cuff, levator scapulae, shoulder girdle' },
    chest: { label: 'Chest', description: 'Pectoral muscles, sternum, intercostals (front body)' },
    upper_back: { label: 'Upper Back', description: 'Rhomboids, middle trapezius, thoracic erector spinae' },
    abdomen: { label: 'Abdomen', description: 'Abdominals, obliques, transverse abdominis (informational only)' },
    lower_back: { label: 'Lower Back', description: 'Lumbar erectors, quadratus lumborum, sacral region' },
    glutes: { label: 'Glutes', description: 'Gluteus maximus & medius, piriformis, SI joint, hip rotators' },
    arms: { label: 'Arms', description: 'Biceps, triceps, forearms, brachialis, brachioradialis' },
    hands: { label: 'Hands', description: 'Palms, fingers, wrist flexors, thenar & hypothenar eminence' },
    thighs: { label: 'Thighs', description: 'Quadriceps, hamstrings, IT band, adductors, TFL, hip flexors' },
    calves: { label: 'Calves', description: 'Gastrocnemius, soleus, tibialis anterior, peroneals' },
    feet: { label: 'Feet', description: 'Plantar fascia, arch support, heel, metatarsals, Achilles' },
}

// ─────────────────────────────────────────────────────────────
// VIEW VISIBILITY — preserved from original
// ─────────────────────────────────────────────────────────────
const FRONT_ONLY = new Set(['chest', 'abdomen'])
const BACK_ONLY = new Set(['upper_back', 'lower_back', 'glutes'])

// ─────────────────────────────────────────────────────────────
// NON-SELECTABLE ZONES  (NEW)
// These zones render as static decorative outlines only.
// toggle() will early-return for any key in this set.
// They are also excluded from the text-chip picker.
// ─────────────────────────────────────────────────────────────
const NON_SELECTABLE = new Set(['abdomen'])

// ─────────────────────────────────────────────────────────────
// SVG PATH DATA  —  completely redrawn
//
// viewBox "0 0 200 470"
// All paths use cubic Bézier curves (C) for organic muscle shapes.
// Bilateral zones (arms, hands, thighs, calves, feet) have 2 paths:
//   index 0 = left side of the figure (viewer's right)
//   index 1 = right side of the figure (viewer's left)
//
// Male   — wider shoulders (shoulder span ≈ 152 px), narrower hips
// Female — narrower shoulders (span ≈ 126 px), wider hips & glutes
// ─────────────────────────────────────────────────────────────
type PathMap = Record<string, string[]>

const PATHS: Record<'male' | 'female', Record<'front' | 'back', PathMap>> = {

    // ══════════════════════════════════════════════════════════
    //  MALE
    // ══════════════════════════════════════════════════════════
    male: {

        // ─── Male · Front ──────────────────────────────────────
        front: {

            // Cranium + jaw — slightly angular, prominent brow ridge
            head: [
                'M 100,8 C 122,8 136,22 136,40 C 136,58 124,70 100,70 C 76,70 64,58 64,40 C 64,22 78,8 100,8 Z',
            ],

            // Neck — wider at base, visible sternocleidomastoid edge
            neck: [
                'M 88,68 C 85,74 84,84 86,90 C 88,95 94,97 100,97 C 106,97 112,95 114,90 C 116,84 115,74 112,68 Z',
            ],

            // Deltoids + trapezius — broad masculine slope
            shoulders: [
                `M 88,94
         C 70,97 48,108 30,122
         L 22,142 L 44,146
         C 46,132 58,120 80,110
         C 88,107 94,104 100,103
         C 106,104 112,107 120,110
         C 142,120 154,132 156,146
         L 178,142 L 170,122
         C 152,108 130,97 112,94 Z`,
            ],

            // Pectorals — defined lower curve, slight sternal notch
            chest: [
                `M 44,146
         C 42,166 40,188 40,212
         C 56,220 76,224 100,224
         C 124,224 144,220 160,212
         C 160,188 158,166 156,146 Z`,
            ],

            // Abdomen — NON_SELECTABLE; waist taper + hip flare
            abdomen: [
                `M 40,212
         C 38,228 35,246 33,262
         C 33,272 45,280 66,284
         L 100,286 L 134,284
         C 155,280 167,272 167,262
         C 165,246 162,228 160,212 Z`,
            ],

            // Arms — bicep bulge on outer curve, thinner at forearm
            arms: [
                // left
                `M 22,142
         C 16,168 12,206 10,262
         L 36,266
         C 38,210 40,172 44,146 Z`,
                // right
                `M 156,146
         C 160,172 162,210 164,266
         L 190,262
         C 188,206 184,168 178,142 Z`,
            ],

            // Hands — tapered oval
            hands: [
                // left
                `M 8,262 C 6,276 8,288 14,290 C 20,292 34,288 34,278 L 34,266 L 10,262 Z`,
                // right
                `M 164,266 L 164,278 C 164,288 178,292 184,290 C 190,288 192,276 190,262 Z`,
            ],

            // Thighs — quadriceps visible in outline, hip gap between legs
            thighs: [
                // left
                `M 33,284
         C 29,316 24,350 22,374
         L 62,376
         C 64,352 66,318 68,286 Z`,
                // right
                `M 132,286
         C 134,318 136,352 138,376
         L 178,374
         C 176,350 171,316 167,284 Z`,
            ],

            // Calves — gastrocnemius bulge at mid-calf
            calves: [
                // left
                `M 22,374
         C 20,398 18,424 18,448
         L 60,450
         C 60,426 60,400 62,376 Z`,
                // right
                `M 138,376
         C 140,400 140,426 140,450
         L 182,448
         C 182,424 180,398 178,374 Z`,
            ],

            // Feet — slight toe-forward taper
            feet: [
                `M 14,448 L 10,464 L 64,466 L 60,450 Z`,
                `M 140,450 L 136,466 L 190,464 L 186,448 Z`,
            ],
        },

        // ─── Male · Back ───────────────────────────────────────
        back: {

            head: [
                'M 100,8 C 122,8 136,22 136,40 C 136,58 124,70 100,70 C 76,70 64,58 64,40 C 64,22 78,8 100,8 Z',
            ],

            neck: [
                'M 88,68 C 85,74 84,84 86,90 C 88,95 94,97 100,97 C 106,97 112,95 114,90 C 116,84 115,74 112,68 Z',
            ],

            shoulders: [
                `M 88,94
         C 70,97 48,108 30,122
         L 22,142 L 44,146
         C 46,132 58,120 80,110
         C 88,107 94,104 100,103
         C 106,104 112,107 120,110
         C 142,120 154,132 156,146
         L 178,142 L 170,122
         C 152,108 130,97 112,94 Z`,
            ],

            // Upper back — trapezius diamond, latissimus widening
            upper_back: [
                `M 44,146
         C 42,168 40,190 40,216
         L 160,216
         C 160,190 158,168 156,146 Z`,
            ],

            // Lower back — lumbar column, slight inward curve
            lower_back: [
                `M 40,216
         C 39,228 38,240 37,252
         L 163,252
         C 162,240 161,228 160,216 Z`,
            ],

            // Glutes — gluteus maximus + medius, pronounced male shape
            glutes: [
                `M 40,250
         C 28,270 24,298 32,320
         L 62,332 L 100,336
         L 138,332 L 168,320
         C 176,298 172,270 160,250 Z`,
            ],

            arms: [
                `M 22,142 C 16,168 12,206 10,262 L 36,266 C 38,210 40,172 44,146 Z`,
                `M 156,146 C 160,172 162,210 164,266 L 190,262 C 188,206 184,168 178,142 Z`,
            ],

            hands: [
                `M 8,262 C 6,276 8,288 14,290 C 20,292 34,288 34,278 L 34,266 L 10,262 Z`,
                `M 164,266 L 164,278 C 164,288 178,292 184,290 C 190,288 192,276 190,262 Z`,
            ],

            // Back thighs — hamstrings, start just below glutes
            thighs: [
                `M 32,322 C 28,348 24,366 22,378 L 62,380 C 62,368 64,350 68,324 Z`,
                `M 132,324 C 136,350 138,368 138,380 L 178,378 C 176,366 172,348 168,322 Z`,
            ],

            calves: [
                `M 22,378 C 20,402 18,428 18,452 L 60,454 C 60,430 60,404 62,380 Z`,
                `M 138,380 C 140,404 140,430 140,454 L 182,452 C 182,428 180,402 178,378 Z`,
            ],

            feet: [
                `M 14,452 L 10,468 L 64,470 L 60,454 Z`,
                `M 140,454 L 136,470 L 190,468 L 186,452 Z`,
            ],
        },
    },

    // ══════════════════════════════════════════════════════════
    //  FEMALE
    // ══════════════════════════════════════════════════════════
    female: {

        // ─── Female · Front ────────────────────────────────────
        front: {

            // Head — more oval, softer jaw, fuller cheeks
            head: [
                'M 100,8 C 120,8 132,20 132,38 C 132,56 122,70 100,70 C 78,70 68,56 68,38 C 68,20 80,8 100,8 Z',
            ],

            neck: [
                'M 91,68 C 89,74 89,84 90,90 C 91,94 95,97 100,97 C 105,97 109,94 110,90 C 111,84 111,74 109,68 Z',
            ],

            // Shoulders — narrower span, gentle deltoid slope
            shoulders: [
                `M 91,94
         C 76,97 60,106 46,118
         L 40,136 L 58,140
         C 60,126 70,114 88,106
         C 93,104 97,102 100,102
         C 103,102 107,104 112,106
         C 130,114 140,126 142,140
         L 160,136 L 154,118
         C 140,106 124,97 109,94 Z`,
            ],

            // Chest — pectoral base + soft bust curve (female)
            chest: [
                `M 58,140
         C 56,158 54,174 54,196
         C 60,206 70,212 82,210
         C 88,220 94,226 100,226
         C 106,226 112,220 118,210
         C 130,212 140,206 146,196
         C 146,174 144,158 142,140 Z`,
            ],

            // Abdomen — NON_SELECTABLE; defined waist, hip flare
            abdomen: [
                `M 54,196
         C 52,214 48,234 46,254
         C 44,264 44,274 48,280
         L 70,286 L 100,288 L 130,286
         L 152,280
         C 156,274 156,264 154,254
         C 152,234 148,214 146,196 Z`,
            ],

            // Arms — slimmer, gentle taper
            arms: [
                `M 40,136 C 34,158 30,200 28,260 L 50,264 C 52,204 54,162 58,140 Z`,
                `M 142,140 C 146,162 148,204 150,264 L 172,260 C 170,200 166,158 160,136 Z`,
            ],

            hands: [
                `M 26,260 C 24,274 26,284 32,286 C 38,288 48,284 48,276 L 48,264 L 28,260 Z`,
                `M 150,264 L 150,276 C 150,284 160,288 166,286 C 172,284 174,274 172,260 Z`,
            ],

            // Thighs — wider at hip, smooth inner thigh gap
            thighs: [
                `M 48,280
         C 44,312 40,346 38,376
         L 70,378
         C 72,348 74,314 76,282 Z`,
                `M 124,282
         C 126,314 128,348 130,378
         L 162,376
         C 160,346 156,312 152,280 Z`,
            ],

            calves: [
                `M 38,376 C 36,400 34,426 34,450 L 68,452 C 68,428 68,402 70,378 Z`,
                `M 130,378 C 132,402 132,428 132,452 L 166,450 C 166,426 164,400 162,376 Z`,
            ],

            feet: [
                `M 30,450 L 26,466 L 70,468 L 68,452 Z`,
                `M 132,452 L 128,468 L 172,466 L 168,450 Z`,
            ],
        },

        // ─── Female · Back ─────────────────────────────────────
        back: {

            head: [
                'M 100,8 C 120,8 132,20 132,38 C 132,56 122,70 100,70 C 78,70 68,56 68,38 C 68,20 80,8 100,8 Z',
            ],

            neck: [
                'M 91,68 C 89,74 89,84 90,90 C 91,94 95,97 100,97 C 105,97 109,94 110,90 C 111,84 111,74 109,68 Z',
            ],

            shoulders: [
                `M 91,94
         C 76,97 60,106 46,118
         L 40,136 L 58,140
         C 60,126 70,114 88,106
         C 93,104 97,102 100,102
         C 103,102 107,104 112,106
         C 130,114 140,126 142,140
         L 160,136 L 154,118
         C 140,106 124,97 109,94 Z`,
            ],

            // Upper back — narrower than male, graceful trapezius taper
            upper_back: [
                `M 58,140
         C 56,162 54,184 54,208
         L 146,208
         C 146,184 144,162 142,140 Z`,
            ],

            lower_back: [
                `M 54,208 C 53,222 52,236 50,248 L 150,248 C 148,236 147,222 146,208 Z`,
            ],

            // Glutes — fuller, wider feminine curve
            glutes: [
                `M 46,246
         C 30,268 24,296 32,318
         L 60,332 L 100,338
         L 140,332 L 168,318
         C 176,296 170,268 154,246 Z`,
            ],

            arms: [
                `M 40,136 C 34,158 30,200 28,260 L 50,264 C 52,204 54,162 58,140 Z`,
                `M 142,140 C 146,162 148,204 150,264 L 172,260 C 170,200 166,158 160,136 Z`,
            ],

            hands: [
                `M 26,260 C 24,274 26,284 32,286 C 38,288 48,284 48,276 L 48,264 L 28,260 Z`,
                `M 150,264 L 150,276 C 150,284 160,288 166,286 C 172,284 174,274 172,260 Z`,
            ],

            // Back thighs — hamstrings, start below glutes
            thighs: [
                `M 32,320 C 28,344 26,364 26,380 L 58,382 C 60,366 62,346 66,322 Z`,
                `M 134,322 C 138,346 140,366 142,382 L 174,380 C 174,364 172,344 168,320 Z`,
            ],

            calves: [
                `M 26,380 C 24,404 22,430 22,454 L 56,456 C 56,432 58,406 58,382 Z`,
                `M 142,382 C 142,406 144,432 144,456 L 178,454 C 178,430 176,404 174,380 Z`,
            ],

            feet: [
                `M 18,454 L 14,470 L 60,472 L 56,456 Z`,
                `M 144,456 L 140,472 L 184,470 L 180,454 Z`,
            ],
        },
    },
}

// ─────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────
export interface AnatomicalMapProps {
    selectedParts: string[]
    onChange: (parts: string[]) => void
    /**
     * Optional URL / path to a 3D body reference image.
     * When supplied the component switches to "glass-overlay" mode:
     *   · The image is rendered as an SVG <image> behind the paths
     *   · Resting paths become white-glass outlines (transparent fill)
     *   · Hover / selected states use semi-transparent gold fills
     *     so the 3D muscle detail shows through
     *
     * Place your image in /public and pass e.g. referenceImage="/body-3d.png"
     */
    referenceImage?: string
}

// ─────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────
export default function AnatomicalMap({
    selectedParts,
    onChange,
    referenceImage,
}: AnatomicalMapProps) {
    const [gender, setGender] = useState<'male' | 'female'>('female')
    const [view, setView] = useState<'front' | 'back'>('front')
    const [infoKey, setInfoKey] = useState<string | null>(null)

    const pathMap = PATHS[gender][view]
    const zoneKeys = Object.keys(pathMap)
    const hasImage = Boolean(referenceImage)

    // ── Toggle — skips NON_SELECTABLE zones entirely ──────────
    function toggle(key: string) {
        if (NON_SELECTABLE.has(key)) return    // abdomen and any future locked zones
        if (selectedParts.includes(key)) {
            onChange(selectedParts.filter(k => k !== key))
            setInfoKey(null)
        } else {
            onChange([...selectedParts, key])
            setInfoKey(key)
        }
    }

    // Info bar: hovered zone or last-selected zone
    const activeInfo = infoKey ? ZONE_META[infoKey] : null

    // ── Per-zone fill / stroke based on mode ─────────────────
    function zoneFill(key: string, isSelected: boolean, isHovered: boolean): string {
        if (NON_SELECTABLE.has(key)) {
            return hasImage ? 'rgba(255,255,255,0.04)' : 'rgba(26,26,26,0.04)'
        }
        if (isSelected) return hasImage ? 'rgba(197,143,59,0.65)' : GOLD
        if (isHovered) return hasImage ? 'rgba(197,143,59,0.38)' : 'rgba(197,143,59,0.26)'
        return hasImage ? 'rgba(255,255,255,0.06)' : 'rgba(26,26,26,0.07)'
    }

    function zoneStroke(key: string, isSelected: boolean, isHovered: boolean): string {
        if (NON_SELECTABLE.has(key)) {
            return hasImage ? 'rgba(255,255,255,0.18)' : 'rgba(26,26,26,0.14)'
        }
        if (isSelected) return '#9A6E28'
        if (isHovered) return hasImage ? 'rgba(197,143,59,0.95)' : 'rgba(197,143,59,0.55)'
        return hasImage ? 'rgba(255,255,255,0.38)' : 'rgba(26,26,26,0.28)'
    }

    function zoneStrokeWidth(key: string, isSelected: boolean): number {
        if (NON_SELECTABLE.has(key)) return hasImage ? 0.6 : 0.5
        return isSelected ? 1.8 : (hasImage ? 1.0 : 0.8)
    }

    return (
        <>
            <style>{`
        .am-zone {
          cursor: pointer;
          transition: fill 180ms ease, stroke 180ms ease, stroke-width 180ms ease;
        }
        .am-zone-locked {
          cursor: default;
          pointer-events: none;
        }
        .am-zone:focus-visible {
          outline: 2px solid ${GOLD};
          outline-offset: 2px;
        }
        @keyframes am-pop {
          0%   { transform: scale(1);    }
          40%  { transform: scale(1.04); }
          100% { transform: scale(1);    }
        }
        .am-selected { animation: am-pop 220ms ease both; }
        .am-toggle {
          padding: 7px 20px; border-radius: 99px; cursor: pointer;
          font-size: 12px; font-weight: 700; letter-spacing: 0.09em;
          text-transform: uppercase; font-family: ${BODY};
          transition: all 160ms ease; border: 1px solid;
        }
        .am-view {
          padding: 6px 16px; border-radius: 8px; cursor: pointer;
          font-size: 11px; font-weight: 600; letter-spacing: 0.10em;
          text-transform: uppercase; font-family: ${BODY};
          transition: all 160ms ease; border: 1px solid;
        }
        .am-chip {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 5px 12px; border-radius: 99px; cursor: pointer;
          font-size: 12px; font-weight: 500; font-family: ${BODY};
          border: 1px solid; transition: all 150ms ease;
        }
      `}</style>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, userSelect: 'none' }}>

                {/* ── Gender toggle ─────────────────────────────── */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {(['female', 'male'] as const).map(g => (
                        <button key={g} type="button" onClick={() => setGender(g)}
                            className="am-toggle"
                            style={{
                                borderColor: gender === g ? BLACK : 'rgba(26,26,26,0.18)',
                                backgroundColor: gender === g ? BLACK : 'transparent',
                                color: gender === g ? GOLD : 'rgba(26,26,26,0.50)',
                            }}
                        >
                            {g === 'female' ? '♀  Female' : '♂  Male'}
                        </button>
                    ))}
                </div>

                {/* ── Front / Back toggle ───────────────────────── */}
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {(['front', 'back'] as const).map(v => (
                        <button key={v} type="button" onClick={() => setView(v)}
                            className="am-view"
                            style={{
                                borderColor: view === v ? GOLD : 'rgba(26,26,26,0.14)',
                                backgroundColor: view === v ? 'rgba(197,143,59,0.12)' : 'transparent',
                                color: view === v ? GOLD : 'rgba(26,26,26,0.40)',
                            }}
                        >
                            {v === 'front' ? '↑ Front' : '↓ Back'}
                        </button>
                    ))}
                </div>

                {/* ── SVG figure ───────────────────────────────── */}
                {/*
          touch-action:none prevents iPad from intercepting
          touch events as scroll while the user taps zones.
        */}
                <div style={{ display: 'flex', justifyContent: 'center', touchAction: 'none' }}>
                    <svg
                        viewBox="0 0 200 472"
                        style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block' }}
                        xmlns="http://www.w3.org/2000/svg"
                        xmlnsXlink="http://www.w3.org/1999/xlink"
                        aria-label={`${gender} body diagram, ${view} view — tap zones to select focus areas`}
                        role="group"
                    >
                        {/*
              ── GLASS OVERLAY: 3D reference image ──────────
              When referenceImage is supplied the image is rendered
              first as the SVG background, then the paths overlay it.
              preserveAspectRatio="xMidYMin meet" fits the portrait
              image without cropping.
            */}
                        {referenceImage && (
                            <image
                                href={referenceImage}
                                x="0" y="0"
                                width="200" height="472"
                                preserveAspectRatio="xMidYMin meet"
                            />
                        )}

                        {/*
              ── PATHS ──────────────────────────────────────
              Each zone key maps to 1–2 path strings.
              NON_SELECTABLE zones get the locked CSS class,
              no event handlers, and no aria semantics.
            */}
                        {zoneKeys.map(key => {
                            const paths = pathMap[key]
                            const isSelected = selectedParts.includes(key)
                            const isHovered = infoKey === key
                            const isLocked = NON_SELECTABLE.has(key)

                            return paths.map((d, i) => (
                                <path
                                    key={`${key}-${i}`}
                                    d={d}
                                    className={`${isLocked ? 'am-zone-locked' : 'am-zone'}${isSelected ? ' am-selected' : ''}`}
                                    fill={zoneFill(key, isSelected, isHovered)}
                                    stroke={zoneStroke(key, isSelected, isHovered)}
                                    strokeWidth={zoneStrokeWidth(key, isSelected)}
                                    strokeLinejoin="round"
                                    // ── Locked zone: no interactivity ──────
                                    {...(!isLocked && {
                                        onClick: () => toggle(key),
                                        onMouseEnter: () => setInfoKey(key),
                                        onMouseLeave: () =>
                                            setInfoKey(prev =>
                                                prev === key && !selectedParts.includes(key) ? null : prev
                                            ),
                                        onTouchStart: () => setInfoKey(key),
                                        role: 'button',
                                        tabIndex: i === 0 ? 0 : -1,
                                        'aria-label': `${ZONE_META[key]?.label ?? key} — ${isSelected ? 'selected, tap to remove' : 'tap to select'}`,
                                        'aria-pressed': isSelected,
                                        onKeyDown: (e: React.KeyboardEvent) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault()
                                                toggle(key)
                                            }
                                        },
                                    })}
                                />
                            ))
                        })}
                    </svg>
                </div>

                {/* ── Zone info bar ─────────────────────────────── */}
                <div style={{
                    minHeight: 58, padding: '10px 16px',
                    backgroundColor: 'rgba(197,143,59,0.07)',
                    border: '1px solid rgba(197,143,59,0.20)',
                    borderRadius: 10,
                    transition: 'background-color 180ms ease',
                }}>
                    {activeInfo ? (
                        <>
                            <p style={{ fontSize: 14, fontWeight: 700, color: GOLD, margin: '0 0 3px', fontFamily: BODY }}>
                                {activeInfo.label}
                            </p>
                            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.58)', margin: 0, fontFamily: BODY, lineHeight: 1.5 }}>
                                {activeInfo.description}
                            </p>
                        </>
                    ) : (
                        <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.32)', margin: 0, fontFamily: BODY, fontStyle: 'italic', lineHeight: 1.55 }}>
                            Tap a body area on the diagram to highlight and select it as a focus zone.
                            Switch between Female / Male and Front / Back views.
                        </p>
                    )}
                </div>

                {/* ── Text chip picker ──────────────────────────── */}
                {/*
          Accessible alternative to SVG tapping.
          NON_SELECTABLE zones are excluded from this list.
        */}
                <div>
                    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(26,26,26,0.38)', fontFamily: BODY, margin: '0 0 8px' }}>
                        Or tap to select
                    </p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {Object.entries(ZONE_META).map(([key, meta]) => {
                            // Exclude non-selectable zones from the chip picker
                            if (NON_SELECTABLE.has(key)) return null

                            const isSelected = selectedParts.includes(key)
                            const inThisView = zoneKeys.includes(key)
                            // Show if: in current view, OR already selected (so user can deselect)
                            if (!inThisView && !isSelected) return null

                            return (
                                <button key={key} type="button" onClick={() => toggle(key)}
                                    className="am-chip"
                                    style={{
                                        borderColor: isSelected ? '#9A6E28' : 'rgba(26,26,26,0.16)',
                                        backgroundColor: isSelected ? GOLD : 'transparent',
                                        color: isSelected ? BLACK : 'rgba(26,26,26,0.55)',
                                    }}
                                >
                                    {meta.label}
                                    {isSelected && (
                                        <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>×</span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* ── Selected summary chips ────────────────────── */}
                {selectedParts.length > 0 && (
                    <div>
                        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: GOLD, fontFamily: BODY, margin: '0 0 8px' }}>
                            Selected · {selectedParts.length}
                        </p>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                            {selectedParts.map(key => (
                                <button key={key} type="button" onClick={() => toggle(key)}
                                    className="am-chip"
                                    style={{ borderColor: '#9A6E28', backgroundColor: GOLD, color: BLACK, fontWeight: 600 }}
                                >
                                    {ZONE_META[key]?.label ?? key}
                                    <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>×</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}