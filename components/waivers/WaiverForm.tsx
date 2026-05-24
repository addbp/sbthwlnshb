'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    Loader2,
    CheckCircle2,
    AlertCircle,
    Heart,
    Stethoscope,
    Shield,
    FileText,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react';
import { createWaiverAction } from '@/lib/actions/waivers';

interface WaiverFormProps {
    clientId: string;
    clientName: string;
    bookingId?: string;
}

const PRESSURE_OPTIONS = ['Light', 'Medium', 'Firm', 'Deep Tissue'];

const FOCUS_AREA_OPTIONS = [
    'Back', 'Neck', 'Shoulders', 'Arms', 'Hands',
    'Legs', 'Feet', 'Scalp', 'Full Body',
];

const HEALTH_CONDITION_OPTIONS = [
    'Hypertension', 'Diabetes', 'Heart Condition', 'Pregnancy',
    'Osteoporosis', 'Recent Surgery', 'Skin Condition', 'Chronic Pain',
    'Cancer / Undergoing Treatment', 'None of the above',
];

const STEPS = ['Service', 'Health', 'Consent'];

export default function WaiverForm({ clientId, clientName, bookingId }: WaiverFormProps) {
    const router = useRouter();
    const [step, setStep] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    // Step 1 — Service
    const [serviceAvailed, setServiceAvailed] = useState('');
    const [preferredPressure, setPreferredPressure] = useState('');
    const [focusAreas, setFocusAreas] = useState<string[]>([]);

    // Step 2 — Health
    const [healthConditions, setHealthConditions] = useState<string[]>([]);
    const [currentMedications, setCurrentMedications] = useState('');
    const [healthConcerns, setHealthConcerns] = useState('');

    // Step 3 — Consent
    const [consentInfoAccurate, setConsentInfoAccurate] = useState(false);
    const [consentWellnessOnly, setConsentWellnessOnly] = useState(false);
    const [consentLiability, setConsentLiability] = useState(false);
    const [consentBehavior, setConsentBehavior] = useState(false);
    const [consentPrivacy, setConsentPrivacy] = useState(false);

    // Signature
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [signatureData, setSignatureData] = useState<string | null>(null);

    const getCoordinates = (e: React.PointerEvent) => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        // Scale coordinates to account for actual vs display size
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        return {
            x: (e.clientX - rect.left) * scaleX,
            y: (e.clientY - rect.top) * scaleY
        };
    };

    const startDrawing = (e: React.PointerEvent) => {
        setIsDrawing(true);
        const coords = getCoordinates(e);
        if (!coords || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
    };

    const draw = (e: React.PointerEvent) => {
        if (!isDrawing) return;
        e.preventDefault();
        const coords = getCoordinates(e);
        if (!coords || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
    };

    const stopDrawing = () => {
        if (isDrawing) {
            setIsDrawing(false);
            if (canvasRef.current) {
                setSignatureData(canvasRef.current.toDataURL('image/png'));
            }
        }
    };

    const clearSignature = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignatureData(null);
    };

    useEffect(() => {
        if (step === 2 && canvasRef.current) {
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineWidth = 3;
                ctx.lineCap = 'round';
                ctx.strokeStyle = '#000000';
            }
        }
    }, [step]);

    const allConsented =
        consentInfoAccurate &&
        consentWellnessOnly &&
        consentLiability &&
        consentBehavior &&
        consentPrivacy;

    const toggleArray = (arr: string[], setArr: (v: string[]) => void, val: string) => {
        setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val]);
    };

    const canAdvance = () => {
        if (step === 0) return serviceAvailed.trim().length > 0;
        if (step === 1) return true;
        if (step === 2) return allConsented && !!signatureData;
        return false;
    };

    const handleSubmit = async () => {
        if (!signatureData) {
            setError('Please sign the waiver before submitting.');
            return;
        }
        setLoading(true);
        setError(null);

        try {
            const result = await createWaiverAction({
                client_id: clientId,
                booking_id: bookingId || null,
                service_availed: serviceAvailed,
                preferred_pressure: preferredPressure,
                focus_areas: focusAreas,
                health_conditions: healthConditions,
                current_medications: currentMedications,
                health_concerns: healthConcerns,
                consent_information_accurate: consentInfoAccurate,
                consent_wellness_only: consentWellnessOnly,
                consent_liability_release: consentLiability,
                consent_behavior_policy: consentBehavior,
                consent_data_privacy: consentPrivacy,
                signature_base64: signatureData,
                device_info: {
                    userAgent: navigator.userAgent,
                    timestamp: new Date().toISOString(),
                },
            });

            if (result.error) {
                setError(result.error);
                setLoading(false);
                return;
            }

            setSuccess(true);
            setTimeout(() => {
                router.push(`/dashboard/clients/${clientId}`);
                router.refresh();
            }, 1500);
        } catch (err: any) {
            setError('A connection error occurred. Please try again.');
            setLoading(false);
        }
    };

    if (success) {
        return (
            <div className="p-12 text-center space-y-4">
                <CheckCircle2 size={48} className="mx-auto text-emerald-500" />
                <div className="font-bold text-brandText text-lg">Waiver Saved Successfully</div>
                <div className="text-xs text-brandAccent/60">Redirecting to client profile...</div>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-2xl mx-auto">

            {/* Client Banner */}
            <div className="flex items-center gap-3 p-4 bg-brandPrimary/20 border border-brandAccent/10 rounded-card">
                <div className="w-10 h-10 rounded-full bg-brandAccent/10 flex items-center justify-center text-brandAccent font-bold text-sm">
                    {clientName?.slice(0, 2).toUpperCase() || '??'}
                </div>
                <div>
                    <div className="text-[10px] uppercase tracking-widest text-brandAccent/40 font-bold">Signing Waiver For</div>
                    <div className="font-bold text-brandText">{clientName}</div>
                </div>
            </div>

            {/* Step Indicator */}
            <div className="flex items-center gap-2">
                {STEPS.map((label, i) => (
                    <div key={label} className="flex items-center gap-2 flex-1">
                        <div className={`flex items-center gap-2 ${i <= step ? 'text-brandAccent' : 'text-brandAccent/30'}`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all ${i < step
                                ? 'bg-brandAccent border-brandAccent text-white'
                                : i === step
                                    ? 'border-brandAccent text-brandAccent'
                                    : 'border-brandAccent/20 text-brandAccent/30'
                                }`}>
                                {i < step ? <CheckCircle2 size={14} /> : i + 1}
                            </div>
                            <span className="text-xs font-bold uppercase tracking-widest hidden sm:block">{label}</span>
                        </div>
                        {i < STEPS.length - 1 && (
                            <div className={`flex-1 h-px ${i < step ? 'bg-brandAccent' : 'bg-brandAccent/10'}`} />
                        )}
                    </div>
                ))}
            </div>

            {/* Error */}
            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-base flex items-center gap-3 text-red-600 text-sm font-bold">
                    <AlertCircle size={18} /> {error}
                </div>
            )}

            {/* Step 0 — Service */}
            {step === 0 && (
                <div className="space-y-8">
                    <div className="border-l-4 border-brandAccent pl-5">
                        <h3 className="brand-heading text-2xl flex items-center gap-2">
                            <FileText size={20} /> Service Details
                        </h3>
                        <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">
                            What service is the client receiving today?
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="label">Service Availed *</label>
                        <input
                            type="text"
                            className="input h-14 text-lg"
                            placeholder="e.g. Swedish Massage, Foot Reflexology"
                            value={serviceAvailed}
                            onChange={e => setServiceAvailed(e.target.value)}
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="label">Preferred Pressure</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {PRESSURE_OPTIONS.map(p => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPreferredPressure(p === preferredPressure ? '' : p)}
                                    className={`h-12 rounded-base border-2 text-sm font-bold transition-all ${preferredPressure === p
                                        ? 'border-brandAccent bg-brandAccent text-white'
                                        : 'border-brandAccent/20 text-brandAccent/60 hover:border-brandAccent hover:text-brandAccent'
                                        }`}
                                >
                                    {p}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="label">Focus Areas</label>
                        <div className="grid grid-cols-3 gap-2">
                            {FOCUS_AREA_OPTIONS.map(area => (
                                <button
                                    key={area}
                                    type="button"
                                    onClick={() => toggleArray(focusAreas, setFocusAreas, area)}
                                    className={`h-10 rounded-base border-2 text-xs font-bold transition-all ${focusAreas.includes(area)
                                        ? 'border-brandAccent bg-brandAccent text-white'
                                        : 'border-brandAccent/20 text-brandAccent/60 hover:border-brandAccent hover:text-brandAccent'
                                        }`}
                                >
                                    {area}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Step 1 — Health */}
            {step === 1 && (
                <div className="space-y-8">
                    <div className="border-l-4 border-brandAccent pl-5">
                        <h3 className="brand-heading text-2xl flex items-center gap-2">
                            <Stethoscope size={20} /> Health Disclosure
                        </h3>
                        <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">
                            For the safety and comfort of the client.
                        </p>
                    </div>

                    <div className="space-y-3">
                        <label className="label">Health Conditions</label>
                        <div className="grid grid-cols-2 gap-2">
                            {HEALTH_CONDITION_OPTIONS.map(condition => (
                                <button
                                    key={condition}
                                    type="button"
                                    onClick={() => toggleArray(healthConditions, setHealthConditions, condition)}
                                    className={`h-12 px-3 rounded-base border-2 text-xs font-bold text-left transition-all ${healthConditions.includes(condition)
                                        ? 'border-brandAccent bg-brandAccent text-white'
                                        : 'border-brandAccent/20 text-brandAccent/60 hover:border-brandAccent hover:text-brandAccent'
                                        }`}
                                >
                                    {condition}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="label">Current Medications (Optional)</label>
                        <input
                            type="text"
                            className="input h-14"
                            placeholder="List any medications currently taken"
                            value={currentMedications}
                            onChange={e => setCurrentMedications(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="label">Additional Health Concerns (Optional)</label>
                        <textarea
                            className="input min-h-[100px] resize-none py-4"
                            placeholder="Any other concerns the therapist should know about..."
                            value={healthConcerns}
                            onChange={e => setHealthConcerns(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* Step 2 — Consent */}
            {step === 2 && (
                <div className="space-y-8">
                    <div className="border-l-4 border-brandAccent pl-5">
                        <h3 className="brand-heading text-2xl flex items-center gap-2">
                            <Shield size={20} /> Consent & Agreements
                        </h3>
                        <p className="text-xs text-brandAccent/60 mt-1 uppercase tracking-wider font-medium">
                            All items must be acknowledged to proceed.
                        </p>
                    </div>

                    <div className="space-y-4">
                        {[
                            {
                                key: 'info',
                                state: consentInfoAccurate,
                                set: setConsentInfoAccurate,
                                label: 'I confirm that all information provided is accurate and complete to the best of my knowledge.',
                            },
                            {
                                key: 'wellness',
                                state: consentWellnessOnly,
                                set: setConsentWellnessOnly,
                                label: 'I understand that the services provided are for wellness and relaxation purposes only, and are not a substitute for medical treatment.',
                            },
                            {
                                key: 'liability',
                                state: consentLiability,
                                set: setConsentLiability,
                                label: 'I release the establishment and its staff from liability for any adverse reactions arising from undisclosed health conditions.',
                            },
                            {
                                key: 'behavior',
                                state: consentBehavior,
                                set: setConsentBehavior,
                                label: 'I agree to conduct myself respectfully and in accordance with the establishment\'s behavior and wellness policy.',
                            },
                            {
                                key: 'privacy',
                                state: consentPrivacy,
                                set: setConsentPrivacy,
                                label: 'I consent to the collection and storage of my personal and health information for service and safety purposes.',
                            },
                        ].map(item => (
                            <button
                                key={item.key}
                                type="button"
                                onClick={() => item.set(!item.state)}
                                className={`w-full text-left p-5 rounded-card border-2 transition-all flex items-start gap-4 ${item.state
                                    ? 'border-brandAccent bg-brandAccent/5'
                                    : 'border-brandAccent/20 hover:border-brandAccent/40'
                                    }`}
                            >
                                <div className={`mt-0.5 shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${item.state ? 'border-brandAccent bg-brandAccent' : 'border-brandAccent/30'
                                    }`}>
                                    {item.state && <CheckCircle2 size={12} className="text-white" />}
                                </div>
                                <span className={`text-sm leading-relaxed ${item.state ? 'text-brandText font-medium' : 'text-brandAccent/60'}`}>
                                    {item.label}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Signature Pad */}
                    <div className="space-y-4 pt-4 border-t border-brandAccent/10">
                        <div className="flex justify-between items-end">
                            <label className="label">Client Signature *</label>
                            {signatureData && (
                                <button
                                    type="button"
                                    onClick={clearSignature}
                                    className="text-xs font-bold text-brandAccent/60 hover:text-red-500 uppercase tracking-widest transition-colors"
                                >
                                    Clear Signature
                                </button>
                            )}
                        </div>
                        <div className="border-2 border-brandAccent/20 rounded-base overflow-hidden bg-white">
                            <canvas
                                ref={canvasRef}
                                width={600}
                                height={200}
                                className="w-full h-[200px] touch-none cursor-crosshair"
                                onPointerDown={startDrawing}
                                onPointerMove={draw}
                                onPointerUp={stopDrawing}
                                onPointerOut={stopDrawing}
                            />
                        </div>
                        {!signatureData && (
                            <div className="text-xs text-brandAccent/50 italic">
                                Please sign in the box above.
                            </div>
                        )}
                    </div>

                    {allConsented && signatureData && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-base flex items-center gap-3 text-emerald-700 text-sm font-bold">
                            <CheckCircle2 size={18} /> All consents acknowledged and signed. Ready to submit.
                        </div>
                    )}
                </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between items-center border-t border-brandAccent/10 pt-8">
                <button
                    type="button"
                    onClick={() => step === 0 ? router.back() : setStep(step - 1)}
                    className="px-8 h-14 text-brandAccent/60 font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:text-brandAccent transition-colors"
                >
                    <ChevronLeft size={16} />
                    {step === 0 ? 'Cancel' : 'Back'}
                </button>

                {step < STEPS.length - 1 ? (
                    <button
                        type="button"
                        onClick={() => setStep(step + 1)}
                        disabled={!canAdvance()}
                        className="btn-primary h-14 min-w-[200px] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span className="uppercase tracking-widest text-sm font-bold">Next</span>
                        <ChevronRight size={16} />
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={loading || !allConsented || !signatureData}
                        className="btn-primary h-14 min-w-[240px] flex items-center justify-center gap-3 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
                        <span className="uppercase tracking-widest text-sm font-bold">
                            {loading ? 'Saving...' : 'Submit Waiver'}
                        </span>
                    </button>
                )}
            </div>
        </div>
    );
}