const fs = require('fs');

const formPath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/components/waivers/WaiverForm.tsx';
let code = fs.readFileSync(formPath, 'utf8');

// 1. imports
code = code.replace(
  "import { useState } from 'react';",
  "import { useState, useRef, useEffect } from 'react';"
);

// 2. state and refs
code = code.replace(
  "    const [consentPrivacy, setConsentPrivacy] = useState(false);",
  `    const [consentPrivacy, setConsentPrivacy] = useState(false);

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
    }, [step]);`
);

// 3. Update canAdvance
code = code.replace(
  "        if (step === 2) return allConsented;",
  "        if (step === 2) return allConsented && !!signatureData;"
);

// 4. Update handleSubmit
code = code.replace(
  "    const handleSubmit = async () => {\n        setLoading(true);\n        setError(null);",
  `    const handleSubmit = async () => {
        if (!signatureData) {
            setError('Please sign the waiver before submitting.');
            return;
        }
        setLoading(true);
        setError(null);`
);
code = code.replace(
  "    const handleSubmit = async () => {\r\n        setLoading(true);\r\n        setError(null);",
  `    const handleSubmit = async () => {
        if (!signatureData) {
            setError('Please sign the waiver before submitting.');
            return;
        }
        setLoading(true);
        setError(null);`
);

// Add signature_base64 to payload
code = code.replace(
  "                consent_data_privacy: consentPrivacy,",
  "                consent_data_privacy: consentPrivacy,\n                signature_base64: signatureData,"
);

// 5. Add Canvas to Step 2
const oldConsentAll = `                    {allConsented && (
                        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-base flex items-center gap-3 text-emerald-700 text-sm font-bold">
                            <CheckCircle2 size={18} /> All consents acknowledged. Ready to submit.
                        </div>
                    )}`;

const newConsentAll = `                    {/* Signature Pad */}
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
                    )}`;

code = code.replace(oldConsentAll, newConsentAll);
code = code.replace(oldConsentAll.replace(/\n/g, '\r\n'), newConsentAll);

// 6. Update submit button disabled state
code = code.replace(
  "disabled={loading || !allConsented}",
  "disabled={loading || !allConsented || !signatureData}"
);

fs.writeFileSync(formPath, code);
console.log('form updated');
