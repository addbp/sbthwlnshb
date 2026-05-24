// app/dashboard/bookings/components/BodyTargetSelector.tsx
// Placeholder — Phase 1: Gender toggle + body part checklist
// Phase 2 will replace the body part list with an interactive SVG diagram.

'use client';

import { useState, useCallback } from 'react';

// ── Types ──────────────────────────────────────────────────────
export type Gender = 'men' | 'women';

export interface BodyTargetSelectorProps {
    /** Currently selected gender tab */
    gender?: Gender;
    /** Currently selected body parts (array of part keys) */
    selected?: string[];
    /** Called when gender changes */
    onGenderChange?: (gender: Gender) => void;
    /** Called when the selected body parts array changes */
    onSelectionChange?: (parts: string[]) => void;
    /** Maximum number of body parts that can be selected (0 = unlimited) */
    maxSelections?: number;
    /** Compact layout for embedding inside a wider form */
    compact?: boolean;
}

// ── Body Part Definitions (Phase 1: text list) ─────────────────
// Each entry: { key, label, region }
// Phase 2: add svgPathId for the SVG diagram integration.

const BODY_PARTS_MEN = [
    // Upper body
    { key: 'head', label: 'Head & Scalp', region: 'Upper' },
    { key: 'neck', label: 'Neck', region: 'Upper' },
    { key: 'shoulders', label: 'Shoulders', region: 'Upper' },
    { key: 'upper_back', label: 'Upper Back', region: 'Upper' },
    { key: 'chest', label: 'Chest', region: 'Upper' },
    { key: 'arms', label: 'Arms', region: 'Upper' },
    { key: 'forearms', label: 'Forearms', region: 'Upper' },
    { key: 'hands', label: 'Hands', region: 'Upper' },
    // Core
    { key: 'lower_back', label: 'Lower Back', region: 'Core' },
    { key: 'abdomen', label: 'Abdomen', region: 'Core' },
    { key: 'obliques', label: 'Obliques / Sides', region: 'Core' },
    // Lower body
    { key: 'glutes', label: 'Glutes', region: 'Lower' },
    { key: 'thighs', label: 'Thighs', region: 'Lower' },
    { key: 'hamstrings', label: 'Hamstrings', region: 'Lower' },
    { key: 'calves', label: 'Calves', region: 'Lower' },
    { key: 'feet', label: 'Feet & Ankles', region: 'Lower' },
];

const BODY_PARTS_WOMEN = [
    // Upper body
    { key: 'head', label: 'Head & Scalp', region: 'Upper' },
    { key: 'neck', label: 'Neck', region: 'Upper' },
    { key: 'shoulders', label: 'Shoulders', region: 'Upper' },
    { key: 'upper_back', label: 'Upper Back', region: 'Upper' },
    { key: 'décolletage', label: 'Décolletage', region: 'Upper' },
    { key: 'arms', label: 'Arms', region: 'Upper' },
    { key: 'forearms', label: 'Forearms', region: 'Upper' },
    { key: 'hands', label: 'Hands', region: 'Upper' },
    // Core
    { key: 'lower_back', label: 'Lower Back', region: 'Core' },
    { key: 'abdomen', label: 'Abdomen', region: 'Core' },
    { key: 'obliques', label: 'Obliques / Sides', region: 'Core' },
    // Lower body
    { key: 'glutes', label: 'Glutes', region: 'Lower' },
    { key: 'hips_thighs', label: 'Hips & Thighs', region: 'Lower' },
    { key: 'hamstrings', label: 'Hamstrings', region: 'Lower' },
    { key: 'calves', label: 'Calves', region: 'Lower' },
    { key: 'feet', label: 'Feet & Ankles', region: 'Lower' },
];

const REGIONS = ['Upper', 'Core', 'Lower'];

// ── Component ─────────────────────────────────────────────────
export default function BodyTargetSelector({
    gender: controlledGender,
    selected: controlledSelected,
    onGenderChange,
    onSelectionChange,
    maxSelections = 0,
    compact = false,
}: BodyTargetSelectorProps) {
    // Support both controlled and uncontrolled usage
    const [internalGender, setInternalGender] = useState<Gender>('women');
    const [internalSelected, setInternalSelected] = useState<string[]>([]);

    const gender = controlledGender ?? internalGender;
    const selected = controlledSelected ?? internalSelected;

    const bodyParts = gender === 'men' ? BODY_PARTS_MEN : BODY_PARTS_WOMEN;

    // ── Handlers ──────────────────────────────────────────────
    const handleGenderChange = useCallback((g: Gender) => {
        // Clear selection when switching gender (parts differ)
        if (!controlledSelected) setInternalSelected([]);
        onSelectionChange?.([]);
        if (!controlledGender) setInternalGender(g);
        onGenderChange?.(g);
    }, [controlledGender, controlledSelected, onGenderChange, onSelectionChange]);

    const togglePart = useCallback((key: string) => {
        const next = selected.includes(key)
            ? selected.filter(k => k !== key)
            : (maxSelections > 0 && selected.length >= maxSelections)
                ? selected   // silently cap
                : [...selected, key];

        if (!controlledSelected) setInternalSelected(next);
        onSelectionChange?.(next);
    }, [selected, maxSelections, controlledSelected, onSelectionChange]);

    const clearAll = useCallback(() => {
        if (!controlledSelected) setInternalSelected([]);
        onSelectionChange?.([]);
    }, [controlledSelected, onSelectionChange]);

    const selectRegion = useCallback((region: string) => {
        const regionKeys = bodyParts.filter(p => p.region === region).map(p => p.key);
        const allSelected = regionKeys.every(k => selected.includes(k));
        const next = allSelected
            ? selected.filter(k => !regionKeys.includes(k))
            : [...new Set([...selected, ...regionKeys])];

        if (!controlledSelected) setInternalSelected(next);
        onSelectionChange?.(next);
    }, [bodyParts, selected, controlledSelected, onSelectionChange]);

    // ── Render ────────────────────────────────────────────────
    return (
        <div style={{
            backgroundColor: '#F5F5DC',
            border: '1px solid rgba(26,26,26,0.12)',
            borderRadius: compact ? 16 : 20,
            overflow: 'hidden',
            fontFamily: "'DM Sans', system-ui, sans-serif",
        }}>

            {/* ── Header ─────────────────────────────────────────── */}
            {!compact && (
                <div style={{
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid rgba(26,26,26,0.1)',
                    backgroundColor: '#EDEDD0',
                }}>
                    <div style={{
                        fontSize: 10, fontWeight: 700, letterSpacing: '0.18em',
                        textTransform: 'uppercase', color: '#C5A059', marginBottom: 4,
                    }}>
                        Target Areas
                    </div>
                    <div style={{
                        fontFamily: "'Cormorant Garamond', Georgia, serif",
                        fontSize: 20, fontWeight: 400, color: '#1A1A1A',
                    }}>
                        Body Target Selector
                    </div>
                    <p style={{ fontSize: 13, color: '#7A7A6A', marginTop: 4, lineHeight: 1.5 }}>
                        Select the body areas this session will focus on.
                        {maxSelections > 0 && ` (Max ${maxSelections})`}
                    </p>
                </div>
            )}

            <div style={{ padding: compact ? '16px' : '24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

                {/* ── Gender Toggle ──────────────────────────────────── */}
                <div>
                    <div style={{
                        fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
                        textTransform: 'uppercase', color: '#7A7A6A', marginBottom: 10,
                    }}>
                        Diagram
                    </div>

                    <div style={{
                        display: 'inline-flex',
                        backgroundColor: '#E8E8C8',
                        borderRadius: 12,
                        padding: 4,
                        border: '1px solid rgba(26,26,26,0.1)',
                    }}>
                        {(['women', 'men'] as Gender[]).map(g => (
                            <button
                                key={g}
                                onClick={() => handleGenderChange(g)}
                                style={{
                                    padding: '0 28px',
                                    minHeight: 44,
                                    borderRadius: 9,
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: 14,
                                    fontWeight: 500,
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                    letterSpacing: '0.04em',
                                    transition: 'all 200ms ease',
                                    backgroundColor: gender === g ? '#C5A059' : 'transparent',
                                    color: gender === g ? '#1A1A1A' : '#7A7A6A',
                                    boxShadow: gender === g ? '0 2px 8px rgba(197,160,89,0.3)' : 'none',
                                }}
                            >
                                {g === 'women' ? '♀ Women' : '♂ Men'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── Phase 2 placeholder ───────────────────────────── */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: compact ? 80 : 120,
                    border: '2px dashed rgba(197,160,89,0.35)',
                    borderRadius: 14,
                    backgroundColor: 'rgba(197,160,89,0.05)',
                    flexDirection: 'column',
                    gap: 8,
                }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#C5A059" strokeWidth="1.5" strokeLinecap="round">
                        <circle cx="12" cy="5" r="2" /><path d="M12 7v5M8 21v-4a4 4 0 0 1 8 0v4" />
                        <path d="M6 11h12M8 14h8" />
                    </svg>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#C5A059', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            SVG Diagram — Phase 2
                        </div>
                        <div style={{ fontSize: 11, color: '#7A7A6A', marginTop: 2 }}>
                            Interactive {gender === 'men' ? 'male' : 'female'} body map will appear here
                        </div>
                    </div>
                </div>

                {/* ── Body Parts Checklist ──────────────────────────── */}
                <div>
                    {/* Checklist header */}
                    <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        marginBottom: 12,
                    }}>
                        <div style={{
                            fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
                            textTransform: 'uppercase', color: '#7A7A6A',
                        }}>
                            Areas ({selected.length} selected)
                        </div>
                        {selected.length > 0 && (
                            <button
                                onClick={clearAll}
                                style={{
                                    fontSize: 11, fontWeight: 500, color: '#A05050',
                                    background: 'none', border: 'none', cursor: 'pointer',
                                    letterSpacing: '0.06em', textTransform: 'uppercase',
                                    fontFamily: "'DM Sans', system-ui, sans-serif",
                                    padding: '4px 8px',
                                }}
                            >
                                Clear all
                            </button>
                        )}
                    </div>

                    {/* Regions */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {REGIONS.map(region => {
                            const regionParts = bodyParts.filter(p => p.region === region);
                            const allSelected = regionParts.every(p => selected.includes(p.key));
                            const someSelected = regionParts.some(p => selected.includes(p.key));

                            return (
                                <div key={region}>
                                    {/* Region header with select-all toggle */}
                                    <div style={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        marginBottom: 8,
                                    }}>
                                        <span style={{
                                            fontSize: 10, fontWeight: 700, letterSpacing: '0.16em',
                                            textTransform: 'uppercase', color: '#C5A059',
                                        }}>
                                            {region} Body
                                        </span>
                                        <button
                                            onClick={() => selectRegion(region)}
                                            style={{
                                                fontSize: 10, fontWeight: 600, letterSpacing: '0.1em',
                                                textTransform: 'uppercase', cursor: 'pointer',
                                                background: 'none', border: '1px solid',
                                                borderColor: allSelected ? '#C5A059' : 'rgba(26,26,26,0.15)',
                                                borderRadius: 6, padding: '3px 10px',
                                                color: allSelected ? '#C5A059' : '#7A7A6A',
                                                fontFamily: "'DM Sans', system-ui, sans-serif",
                                                transition: 'all 150ms ease',
                                            }}
                                        >
                                            {allSelected ? 'Deselect All' : someSelected ? 'Select All' : 'Select All'}
                                        </button>
                                    </div>

                                    {/* Parts grid */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: compact
                                            ? 'repeat(auto-fill, minmax(140px, 1fr))'
                                            : 'repeat(auto-fill, minmax(160px, 1fr))',
                                        gap: 8,
                                    }}>
                                        {regionParts.map(part => {
                                            const isChecked = selected.includes(part.key);
                                            return (
                                                <button
                                                    key={part.key}
                                                    onClick={() => togglePart(part.key)}
                                                    style={{
                                                        display: 'flex', alignItems: 'center', gap: 10,
                                                        padding: '0 14px', minHeight: 48, borderRadius: 10,
                                                        cursor: 'pointer', textAlign: 'left',
                                                        fontFamily: "'DM Sans', system-ui, sans-serif",
                                                        fontSize: 13.5, fontWeight: isChecked ? 500 : 400,
                                                        transition: 'all 180ms ease',
                                                        border: '1px solid',
                                                        borderColor: isChecked ? '#C5A059' : 'rgba(26,26,26,0.15)',
                                                        backgroundColor: isChecked ? 'rgba(197,160,89,0.12)' : '#F5F5DC',
                                                        color: isChecked ? '#1A1A1A' : '#4A4A4A',
                                                        boxShadow: isChecked ? '0 2px 8px rgba(197,160,89,0.2)' : 'none',
                                                    }}
                                                    aria-pressed={isChecked}
                                                    aria-label={`${isChecked ? 'Deselect' : 'Select'} ${part.label}`}
                                                >
                                                    {/* Checkbox indicator */}
                                                    <span style={{
                                                        flexShrink: 0,
                                                        width: 18, height: 18,
                                                        borderRadius: 5,
                                                        border: `1.5px solid ${isChecked ? '#C5A059' : 'rgba(26,26,26,0.25)'}`,
                                                        backgroundColor: isChecked ? '#C5A059' : 'transparent',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        transition: 'all 180ms ease',
                                                    }}>
                                                        {isChecked && (
                                                            <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                                                <path d="M2 6l3 3 5-5" stroke="#1A1A1A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                                                            </svg>
                                                        )}
                                                    </span>
                                                    {part.label}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ── Selected Summary ──────────────────────────────── */}
                {selected.length > 0 && (
                    <div style={{
                        padding: '14px 18px',
                        backgroundColor: 'rgba(197,160,89,0.1)',
                        border: '1px solid rgba(197,160,89,0.25)',
                        borderRadius: 12,
                    }}>
                        <div style={{
                            fontSize: 10, fontWeight: 700, letterSpacing: '0.14em',
                            textTransform: 'uppercase', color: '#C5A059', marginBottom: 8,
                        }}>
                            Selected Areas
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {selected.map(key => {
                                const part = bodyParts.find(p => p.key === key);
                                return (
                                    <span key={key} style={{
                                        display: 'inline-flex', alignItems: 'center', gap: 6,
                                        padding: '4px 12px', borderRadius: 99,
                                        backgroundColor: '#C5A059', color: '#1A1A1A',
                                        fontSize: 12, fontWeight: 500,
                                    }}>
                                        {part?.label ?? key}
                                        <button
                                            onClick={() => togglePart(key)}
                                            style={{
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                width: 14, height: 14, borderRadius: '50%',
                                                background: 'rgba(26,26,26,0.2)', border: 'none',
                                                cursor: 'pointer', color: '#1A1A1A', padding: 0,
                                                fontSize: 10, fontWeight: 700, lineHeight: 1,
                                                fontFamily: 'sans-serif',
                                            }}
                                            aria-label={`Remove ${part?.label}`}
                                        >
                                            ×
                                        </button>
                                    </span>
                                );
                            })}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Usage Example (for devs) ───────────────────────────────────
//
// Uncontrolled (simplest):
//   <BodyTargetSelector onSelectionChange={(parts) => console.log(parts)} />
//
// Controlled (with form state):
//   const [gender, setGender] = useState<Gender>('women');
//   const [bodyParts, setBodyParts] = useState<string[]>([]);
//   <BodyTargetSelector
//     gender={gender}
//     selected={bodyParts}
//     onGenderChange={setGender}
//     onSelectionChange={setBodyParts}
//     maxSelections={5}
//   />
//
// Compact embed inside a booking form:
//   <BodyTargetSelector compact onSelectionChange={setValue('target_body_parts')} />