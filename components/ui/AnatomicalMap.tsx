'use client'
import React from 'react'

const MUSCLE_ZONES = [
    { id: 'Neck', label: 'Neck & Cervical' },
    { id: 'Traps', label: 'Trapezius (Upper Back)' },
    { id: 'Shoulders', label: 'Deltoids (Shoulders)' },
    { id: 'UpperBack', label: 'Lats & Rhomboids (Upper Back)' },
    { id: 'LowerBack', label: 'Lumbar (Lower Back)' },
    { id: 'Chest', label: 'Pectorals (Chest)' },
    { id: 'Abs', label: 'Abdominals (Stomach)' },
    { id: 'Arms', label: 'Biceps & Triceps (Arms)' },
    { id: 'Hands', label: 'Forearms & Hands' },
    { id: 'Glutes', label: 'Glutes (Hips)' },
    { id: 'Quads', label: 'Quadriceps (Front Thighs)' },
    { id: 'Hamstrings', label: 'Hamstrings (Back Thighs)' },
    { id: 'Calves', label: 'Calves' },
    { id: 'Feet', label: 'Feet & Ankles' },
]

export default function AnatomicalMap({
    selectedParts,
    onChange
}: {
    selectedParts: string[],
    onChange: (parts: string[]) => void
}) {

    const togglePart = (id: string) => {
        if (selectedParts.includes(id)) {
            onChange(selectedParts.filter(p => p !== id))
        } else {
            onChange([...selectedParts, id])
        }
    }

    return (
        <div style={{ padding: '10px 0' }}>
            <p style={{ fontSize: 13, color: '#7A6E65', marginBottom: 16 }}>
                Select the specific muscular zones you would like the therapist to focus on:
            </p>

            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 12
            }}>
                {MUSCLE_ZONES.map(zone => {
                    const isSelected = selectedParts.includes(zone.id)
                    return (
                        <button
                            key={zone.id}
                            type="button"
                            onClick={() => togglePart(zone.id)}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '14px 16px',
                                borderRadius: 12,
                                border: `1.5px solid ${isSelected ? '#1A1A1A' : 'rgba(26,26,26,0.1)'}`,
                                backgroundColor: isSelected ? '#1A1A1A' : '#FFFFFF',
                                color: isSelected ? '#C58F3B' : '#1A1A1A',
                                cursor: 'pointer',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.1)' : 'none'
                            }}
                        >
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{zone.label}</span>
                            <div style={{
                                width: 18, height: 18, borderRadius: '50%',
                                border: `1.5px solid ${isSelected ? '#C58F3B' : 'rgba(26,26,26,0.3)'}`,
                                backgroundColor: isSelected ? '#C58F3B' : 'transparent',
                                display: 'flex', alignItems: 'center', justifyContent: 'center'
                            }}>
                                {isSelected && (
                                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                                        <path d="M2 6l3 3 5-5" stroke="#1A1A1A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </div>
                        </button>
                    )
                })}
            </div>
        </div>
    )
}