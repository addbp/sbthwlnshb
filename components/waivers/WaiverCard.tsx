'use client';

import {
    FileText,
    CheckCircle2,
    XCircle,
    Calendar,
    Clock,
    Stethoscope,
    Heart,
    Shield,
    ChevronDown,
    ChevronUp
} from 'lucide-react';
import { useState } from 'react';

interface WaiverCardProps {
    waiver: any;
}

export default function WaiverCard({ waiver }: WaiverCardProps) {
    const [expanded, setExpanded] = useState(false);

    const signedDate = waiver.signed_at
        ? new Date(waiver.signed_at).toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
        })
        : 'Unknown';

    const signedTime = waiver.signed_at
        ? new Date(waiver.signed_at).toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
        })
        : '';

    const allConsents = [
        { key: 'consent_information_accurate', label: 'Information is accurate' },
        { key: 'consent_wellness_only', label: 'Wellness-only service acknowledged' },
        { key: 'consent_liability_release', label: 'Liability release accepted' },
        { key: 'consent_behavior_policy', label: 'Behavior policy accepted' },
        { key: 'consent_data_privacy', label: 'Data privacy consent given' },
    ];

    const allConsented = allConsents.every(c => waiver[c.key] === true);

    return (
        <div className="brand-card border border-brandAccent/10 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 flex items-center justify-between bg-brandPrimary/20 border-b border-brandAccent/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-brandAccent/10 rounded-base">
                        <FileText size={16} className="text-brandAccent" />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-brandText">
                            {waiver.service_availed || 'General Wellness Waiver'}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                            <span className="flex items-center gap-1 text-[10px] text-brandAccent/50 font-medium">
                                <Calendar size={10} /> {signedDate}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] text-brandAccent/50 font-medium">
                                <Clock size={10} /> {signedTime}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {allConsented ? (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-pill">
                            <CheckCircle2 size={11} /> Fully Signed
                        </span>
                    ) : (
                        <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-pill">
                            <XCircle size={11} /> Incomplete
                        </span>
                    )}
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="p-1.5 rounded-base hover:bg-brandAccent/10 text-brandAccent/40 hover:text-brandAccent transition-colors"
                    >
                        {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </button>
                </div>
            </div>

            {/* Expanded Detail */}
            {expanded && (
                <div className="px-6 py-6 space-y-6">

                    {/* Service Info */}
                    <div className="grid grid-cols-2 gap-4">
                        <DetailItem
                            icon={<Heart size={14} />}
                            label="Preferred Pressure"
                            value={waiver.preferred_pressure || 'Not specified'}
                        />
                        <DetailItem
                            icon={<Stethoscope size={14} />}
                            label="Focus Areas"
                            value={
                                waiver.focus_areas?.length > 0
                                    ? waiver.focus_areas.join(', ')
                                    : 'None specified'
                            }
                        />
                    </div>

                    {/* Health Info */}
                    {(waiver.health_conditions?.length > 0 || waiver.current_medications || waiver.health_concerns) && (
                        <div className="p-4 bg-amber-50 border border-amber-100 rounded-base space-y-3">
                            <div className="text-[10px] uppercase tracking-widest text-amber-700 font-bold">
                                Health Disclosures
                            </div>
                            {waiver.health_conditions?.length > 0 && (
                                <DetailItem
                                    icon={<Stethoscope size={14} />}
                                    label="Health Conditions"
                                    value={waiver.health_conditions.join(', ')}
                                    valueClass="text-amber-800"
                                />
                            )}
                            {waiver.current_medications && (
                                <DetailItem
                                    label="Current Medications"
                                    value={waiver.current_medications}
                                    valueClass="text-amber-800"
                                />
                            )}
                            {waiver.health_concerns && (
                                <DetailItem
                                    label="Additional Concerns"
                                    value={waiver.health_concerns}
                                    valueClass="text-amber-800"
                                />
                            )}
                        </div>
                    )}

                    {/* Consents */}
                    <div className="space-y-2">
                        <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold flex items-center gap-2">
                            <Shield size={12} /> Consent Confirmations
                        </div>
                        <div className="grid grid-cols-1 gap-2">
                            {allConsents.map(c => (
                                <div key={c.key} className="flex items-center gap-2 text-xs">
                                    {waiver[c.key] ? (
                                        <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
                                    ) : (
                                        <XCircle size={14} className="text-red-400 shrink-0" />
                                    )}
                                    <span className={waiver[c.key] ? 'text-brandText' : 'text-red-400'}>
                                        {c.label}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Signature */}
                    {waiver.signature_url && (
                        <div className="space-y-2">
                            <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">
                                Captured Signature
                            </div>
                            <div className="border border-brandAccent/10 rounded-base p-3 bg-white inline-block">
                                <img
                                    src={waiver.signature_url}
                                    alt="Client Signature"
                                    className="max-h-20 object-contain"
                                />
                            </div>
                        </div>
                    )}

                </div>
            )}
        </div>
    );
}

function DetailItem({
    icon,
    label,
    value,
    valueClass = '',
}: {
    icon?: React.ReactNode;
    label: string;
    value: string;
    valueClass?: string;
}) {
    return (
        <div className="flex items-start gap-2">
            {icon && <div className="mt-0.5 text-brandAccent/40 shrink-0">{icon}</div>}
            <div>
                <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold mb-0.5">
                    {label}
                </div>
                <div className={`text-sm font-medium ${valueClass || 'text-brandText'}`}>{value}</div>
            </div>
        </div>
    );
}