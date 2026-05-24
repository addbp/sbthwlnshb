'use client'

import { useState } from 'react'

const GOLD = '#C58F3B'
const BLACK = '#1A1A1A'
const BODY = "'Inter', system-ui, sans-serif"

// ─────────────────────────────────────────────────────────────
// ZONE METADATA (Glutes and Thighs Removed from Selector)
// ─────────────────────────────────────────────────────────────
const ZONE_META: Record<string, { label: string; description: string }> = {
    head: { label: 'Head', description: 'Scalp, temples, crown, forehead and cranial pressure points' },
    neck: { label: 'Neck', description: 'Cervical spine, trapezius upper fibers, suboccipitals, SCM' },
    shoulders: { label: 'Shoulders', description: 'Deltoids, rotator cuff, levator scapulae, shoulder girdle' },
    chest: { label: 'Chest', description: 'Pectoral muscles, sternum, intercostals (front body)' },
    upper_back: { label: 'Upper Back', description: 'Rhomboids, middle trapezius, thoracic erector spinae' },
    abdomen: { label: 'Abdomen', description: 'Abdominals, obliques, transverse abdominis, solar plexus' },
    lower_back: { label: 'Lower Back', description: 'Lumbar erectors, quadratus lumborum, sacral region' },
    arms: { label: 'Arms', description: 'Biceps, triceps, forearms, brachialis, brachioradialis' },
    hands: { label: 'Hands', description: 'Palms, fingers, wrist flexors, thenar & hypothenar eminence' },
    calves: { label: 'Calves', description: 'Gastrocnemius, soleus, tibialis anterior, peroneals' },
    feet: { label: 'Feet', description: 'Plantar fascia, arch support, heel, metatarsals, Achilles' },
}

type PathMap = Record<string, string[]>

// We keep glutes and thighs here so they render, but they are ignored in ZONE_META
const PATHS: Record<'male' | 'female', Record<'front' | 'back', PathMap>> = {
    male: {
        front: {
            head: ['M 100,10 C 126,10 136,26 135,44 C 134,62 122,72 100,72 C 78,72 66,62 65,44 C 64,26 74,10 100,10 Z'],
            neck: ['M 89,70 C 87,76 87,88 89,92 L 111,92 C 113,88 113,76 111,70 Z'],
            shoulders: ['M 89,90 C 68,92 48,102 32,114 L 26,134 L 48,136 C 52,118 68,108 89,100 L 111,100 C 132,108 148,118 152,136 L 174,134 L 168,114 C 152,102 132,92 111,90 Z'],
            chest: ['M 48,136 C 46,164 44,186 44,212 L 156,212 C 156,186 154,164 152,136 Z'],
            abdomen: ['M 44,212 L 40,252 C 40,266 50,276 70,278 L 100,280 L 130,278 C 150,276 160,266 160,252 L 156,212 Z'],
            arms: ['M 26,134 L 18,256 L 40,258 L 48,136 Z', 'M 152,136 L 160,258 L 182,256 L 174,134 Z'],
            hands: ['M 16,256 C 14,270 16,280 22,282 C 28,284 38,280 38,272 L 38,258 L 18,256 Z', 'M 160,258 L 160,272 C 160,280 170,284 176,282 C 182,280 184,270 182,256 Z'],
            thighs: ['M 40,278 L 32,368 L 66,368 L 74,278 Z', 'M 126,278 L 134,368 L 168,368 L 160,278 Z'],
            calves: ['M 32,368 L 26,440 L 64,440 L 66,368 Z', 'M 134,368 L 136,440 L 174,440 L 168,368 Z'],
            feet: ['M 22,440 L 16,456 L 68,456 L 64,440 Z', 'M 136,440 L 132,456 L 182,456 L 174,440 Z'],
        },
        back: {
            head: ['M 100,10 C 126,10 136,26 135,44 C 134,62 122,72 100,72 C 78,72 66,62 65,44 C 64,26 74,10 100,10 Z'],
            neck: ['M 89,70 C 87,76 87,88 89,92 L 111,92 C 113,88 113,76 111,70 Z'],
            shoulders: ['M 89,90 C 68,92 48,102 32,114 L 26,134 L 48,136 C 52,118 68,108 89,100 L 111,100 C 132,108 148,118 152,136 L 174,134 L 168,114 C 152,102 132,92 111,90 Z'],
            upper_back: ['M 48,136 C 46,164 44,186 44,214 L 156,214 C 156,186 154,164 152,136 Z'],
            lower_back: ['M 44,214 L 42,246 L 158,246 L 156,214 Z'],
            glutes: ['M 46,244 C 34,264 30,290 40,310 L 68,320 L 100,324 L 132,320 L 160,310 C 170,290 166,264 154,244 Z'],
            arms: ['M 26,134 L 18,256 L 40,258 L 48,136 Z', 'M 152,136 L 160,258 L 182,256 L 174,134 Z'],
            hands: ['M 16,256 C 14,270 16,280 22,282 C 28,284 38,280 38,272 L 38,258 L 18,256 Z', 'M 160,258 L 160,272 C 160,280 170,284 176,282 C 182,280 184,270 182,256 Z'],
            thighs: ['M 40,312 L 30,372 L 66,372 L 72,312 Z', 'M 128,312 L 134,372 L 170,372 L 160,312 Z'],
            calves: ['M 30,372 L 24,444 L 64,444 L 66,372 Z', 'M 134,372 L 136,444 L 176,444 L 170,372 Z'],
            feet: ['M 20,444 L 14,460 L 68,460 L 64,444 Z', 'M 136,444 L 132,460 L 184,460 L 176,444 Z'],
        },
    },
    female: {
        front: {
            head: ['M 100,10 C 122,10 132,26 131,44 C 130,62 120,72 100,72 C 80,72 70,62 69,44 C 68,26 78,10 100,10 Z'],
            neck: ['M 91,70 C 89,76 89,88 91,92 L 109,92 C 111,88 111,76 109,70 Z'],
            shoulders: ['M 91,90 C 74,92 56,100 42,112 L 36,130 L 56,132 C 60,114 74,104 91,98 L 109,98 C 126,104 140,114 144,132 L 164,130 L 158,112 C 144,100 126,92 109,90 Z'],
            chest: ['M 56,132 C 54,158 52,176 52,198 C 58,206 70,210 84,208 C 90,218 96,222 100,222 C 104,222 110,218 116,208 C 130,210 142,206 148,198 C 148,176 146,158 144,132 Z'],
            abdomen: ['M 52,198 L 46,240 C 44,258 40,270 40,278 L 68,282 L 100,284 L 132,282 L 160,278 C 160,270 156,258 154,240 L 148,198 Z'],
            arms: ['M 36,130 L 28,252 L 48,254 L 56,132 Z', 'M 144,132 L 152,254 L 172,252 L 164,130 Z'],
            hands: ['M 26,252 C 24,266 26,276 32,278 C 38,280 46,276 46,270 L 46,254 L 28,252 Z', 'M 152,254 L 152,270 C 152,276 160,280 166,278 C 172,276 174,266 172,252 Z'],
            thighs: ['M 40,278 L 30,368 L 66,368 L 76,278 Z', 'M 124,278 L 134,368 L 170,368 L 160,278 Z'],
            calves: ['M 30,368 L 24,440 L 64,440 L 66,368 Z', 'M 134,368 L 136,440 L 174,440 L 170,368 Z'],
            feet: ['M 20,440 L 16,456 L 68,456 L 64,440 Z', 'M 136,440 L 132,456 L 180,456 L 174,440 Z'],
        },
        back: {
            head: ['M 100,10 C 122,10 132,26 131,44 C 130,62 120,72 100,72 C 80,72 70,62 69,44 C 68,26 78,10 100,10 Z'],
            neck: ['M 91,70 C 89,76 89,88 91,92 L 109,92 C 111,88 111,76 109,70 Z'],
            shoulders: ['M 91,90 C 74,92 56,100 42,112 L 36,130 L 56,132 C 60,114 74,104 91,98 L 109,98 C 126,104 140,114 144,132 L 164,130 L 158,112 C 144,100 126,92 109,90 Z'],
            upper_back: ['M 56,132 C 54,158 52,178 52,202 L 148,202 C 148,178 146,158 144,132 Z'],
            lower_back: ['M 52,202 L 50,234 L 150,234 L 148,202 Z'],
            glutes: ['M 42,232 C 28,252 24,278 32,298 L 60,310 L 100,316 L 140,310 L 168,298 C 176,278 172,252 158,232 Z'],
            arms: ['M 36,130 L 28,252 L 48,254 L 56,132 Z', 'M 144,132 L 152,254 L 172,252 L 164,130 Z'],
            hands: ['M 26,252 C 24,266 26,276 32,278 C 38,280 46,276 46,270 L 46,254 L 28,252 Z', 'M 152,254 L 152,270 C 152,276 160,280 166,278 C 172,276 174,266 172,252 Z'],
            thighs: ['M 32,300 L 22,372 L 60,372 L 68,300 Z', 'M 132,300 L 140,372 L 178,372 L 168,300 Z'],
            calves: ['M 22,372 L 18,444 L 58,444 L 60,372 Z', 'M 140,372 L 142,444 L 180,444 L 178,372 Z'],
            feet: ['M 14,444 L 10,460 L 62,460 L 58,444 Z', 'M 142,444 L 138,460 L 184,460 L 180,444 Z'],
        },
    },
}

export interface AnatomicalMapProps {
    selectedParts: string[]
    onChange: (parts: string[]) => void
}

export default function AnatomicalMap({ selectedParts, onChange }: AnatomicalMapProps) {
    const [gender, setGender] = useState<'male' | 'female'>('female')
    const [view, setView] = useState<'front' | 'back'>('front')
    const [infoKey, setInfoKey] = useState<string | null>(null)

    const pathMap = PATHS[gender][view]
    const zoneKeys = Object.keys(pathMap)

    function toggle(key: string) {
        if (key === 'glutes' || key === 'thighs') return // Prevent selection
        if (selectedParts.includes(key)) {
            onChange(selectedParts.filter(k => k !== key))
            setInfoKey(null)
        } else {
            onChange([...selectedParts, key])
            setInfoKey(key)
        }
    }

    const activeInfo = infoKey ? ZONE_META[infoKey] : null

    return (
        <>
            <style>{`
        .am-zone {
          cursor: pointer;
          transition: fill 160ms ease, stroke 160ms ease;
          filter: url(#shadow);
        }
        .am-zone-static {
          cursor: default;
          filter: url(#shadow);
        }
        .am-zone:focus-visible { outline: 2px solid ${GOLD}; outline-offset: 2px; }
        @keyframes am-pop { 0%{transform:scale(1)} 40%{transform:scale(1.04)} 100%{transform:scale(1)} }
        .am-selected { animation: am-pop 220ms ease; }

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
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {(['female', 'male'] as const).map(g => (
                        <button key={g} type="button" onClick={() => setGender(g)}
                            className="am-toggle"
                            style={{
                                borderColor: gender === g ? BLACK : 'rgba(26,26,26,0.18)',
                                backgroundColor: gender === g ? BLACK : 'transparent',
                                color: gender === g ? GOLD : 'rgba(26,26,26,0.50)',
                            }}>
                            {g === 'female' ? '♀  Female' : '♂  Male'}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                    {(['front', 'back'] as const).map(v => (
                        <button key={v} type="button" onClick={() => setView(v)}
                            className="am-view"
                            style={{
                                borderColor: view === v ? GOLD : 'rgba(26,26,26,0.14)',
                                backgroundColor: view === v ? 'rgba(197,143,59,0.12)' : 'transparent',
                                color: view === v ? GOLD : 'rgba(26,26,26,0.40)',
                            }}>
                            {v === 'front' ? '↑ Front' : '↓ Back'}
                        </button>
                    ))}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', touchAction: 'none' }}>
                    <svg
                        viewBox="0 0 200 470"
                        style={{ width: '100%', maxWidth: 260, height: 'auto', display: 'block' }}
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <defs>
                            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="4" stdDeviation="4" floodOpacity="0.2" />
                            </filter>
                            <linearGradient id="clay" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#EAEAEA" />
                                <stop offset="50%" stopColor="#D6D6D6" />
                                <stop offset="100%" stopColor="#BDBDBD" />
                            </linearGradient>
                            <linearGradient id="gold" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#E2B976" />
                                <stop offset="50%" stopColor="#C58F3B" />
                                <stop offset="100%" stopColor="#9A6E28" />
                            </linearGradient>
                        </defs>

                        {zoneKeys.map(key => {
                            const paths = pathMap[key]
                            const isUnselectable = key === 'glutes' || key === 'thighs'
                            const isSelected = !isUnselectable && selectedParts.includes(key)
                            const isHovered = !isUnselectable && infoKey === key

                            return paths.map((d, i) => (
                                <path
                                    key={`${key}-${i}`}
                                    d={d}
                                    className={isUnselectable ? 'am-zone-static' : `am-zone${isSelected ? ' am-selected' : ''}`}
                                    fill={isUnselectable ? 'url(#clay)' : (isSelected ? 'url(#gold)' : isHovered ? '#C58F3B40' : 'url(#clay)')}
                                    stroke={isSelected ? '#7A5A20' : 'rgba(26,26,26,0.2)'}
                                    strokeWidth={isSelected ? 1.5 : 1}
                                    strokeLinejoin="round"
                                    onClick={isUnselectable ? undefined : () => toggle(key)}
                                    onMouseEnter={isUnselectable ? undefined : () => setInfoKey(key)}
                                    onMouseLeave={isUnselectable ? undefined : () => setInfoKey(prev => prev === key && !selectedParts.includes(key) ? null : prev)}
                                    onTouchStart={isUnselectable ? undefined : () => setInfoKey(key)}
                                />
                            ))
                        })}
                    </svg>
                </div>

                <div style={{ minHeight: 58, padding: '10px 16px', backgroundColor: 'rgba(197,143,59,0.07)', border: '1px solid rgba(197,143,59,0.20)', borderRadius: 10 }}>
                    {activeInfo ? (
                        <>
                            <p style={{ fontSize: 14, fontWeight: 700, color: GOLD, margin: '0 0 3px', fontFamily: BODY }}>{activeInfo.label}</p>
                            <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.58)', margin: 0, fontFamily: BODY, lineHeight: 1.5 }}>{activeInfo.description}</p>
                        </>
                    ) : (
                        <p style={{ fontSize: 13, color: 'rgba(26,26,26,0.32)', margin: 0, fontFamily: BODY, fontStyle: 'italic', lineHeight: 1.55 }}>
                            Tap a muscular area on the 3D diagram to highlight and select it.
                        </p>
                    )}
                </div>

                <div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                        {Object.entries(ZONE_META).map(([key, meta]) => {
                            const isSelected = selectedParts.includes(key)
                            const inThisView = zoneKeys.includes(key)
                            if (!inThisView && !isSelected) return null
                            return (
                                <button key={key} type="button" onClick={() => toggle(key)}
                                    className="am-chip"
                                    style={{
                                        borderColor: isSelected ? '#9A6E28' : 'rgba(26,26,26,0.16)',
                                        backgroundColor: isSelected ? GOLD : 'transparent',
                                        color: isSelected ? BLACK : 'rgba(26,26,26,0.55)',
                                    }}>
                                    {meta.label}
                                    {isSelected && <span aria-hidden="true" style={{ fontSize: 13, lineHeight: 1 }}>×</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>
            </div>
        </>
    )
}