"use client";

import { useEffect, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

export default function SettingsPage() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [userEmail, setUserEmail] = useState("");
    const [isEditing, setIsEditing] = useState(false);

    const [formData, setFormData] = useState({
        fullName: "",
        phone: "",
    });

    const [originalData, setOriginalData] = useState({
        fullName: "",
        phone: "",
    });

    const supabaseRef = useRef<SupabaseClient | null>(null);

    if (!supabaseRef.current) {
        supabaseRef.current = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
    }

    const supabase = supabaseRef.current;

    useEffect(() => {
        fetchUserProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function fetchUserProfile() {
        setLoading(true);

        const {
            data: { user },
            error,
        } = await supabase.auth.getUser();

        if (error) {
            console.error("Error fetching user profile:", error.message);
            setLoading(false);
            return;
        }

        if (user) {
            const profileData = {
                fullName: user.user_metadata?.full_name || "",
                phone: user.user_metadata?.phone || "",
            };

            setUserEmail(user.email || "");
            setFormData(profileData);
            setOriginalData(profileData);
        }

        setLoading(false);
    }

    async function handleSaveProfile() {
        setSaving(true);

        const { error } = await supabase.auth.updateUser({
            data: {
                full_name: formData.fullName.trim(),
                phone: formData.phone.trim(),
            },
        });

        if (error) {
            alert("Error saving profile: " + error.message);
            setSaving(false);
            return;
        }

        const updatedData = {
            fullName: formData.fullName.trim(),
            phone: formData.phone.trim(),
        };

        setFormData(updatedData);
        setOriginalData(updatedData);
        setIsEditing(false);
        setSaving(false);
    }

    function handleCancelEdit() {
        setFormData(originalData);
        setIsEditing(false);
    }

    if (loading) {
        return (
            <div className="min-h-screen bg-[#F9F4EB] flex justify-center items-center">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#C58F3B]" />
            </div>
        );
    }

    const initials = formData.fullName
        ? formData.fullName
            .split(" ")
            .filter(Boolean)
            .map((name) => name[0])
            .join("")
            .toUpperCase()
            .substring(0, 2)
        : "SS";

    return (
        <div className="min-h-screen bg-[#F9F4EB] text-[#1A1A1A] p-6 md:p-8 font-['Inter']">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <p className="text-sm font-bold tracking-[0.25em] uppercase text-[#C58F3B] mb-2">
                        Configuration
                    </p>

                    <h1 className="text-4xl md:text-5xl font-['Cormorant_Garamond'] font-semibold">
                        Account Settings
                    </h1>

                    <p className="text-lg text-[#1A1A1A]/65 mt-2">
                        Manage your administrator profile and Sabbath Spa account details.
                    </p>
                </div>

                <div className="bg-white/80 rounded-3xl shadow-sm border border-[#1A1A1A]/10 overflow-hidden">
                    <div className="h-40 bg-[#1A1A1A] relative">
                        <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A] via-[#2A2A2A] to-[#C58F3B]/70" />

                        <div className="absolute -bottom-12 left-8 md:left-10">
                            <div className="w-24 h-24 bg-[#C58F3B] text-[#F9F4EB] rounded-full flex items-center justify-center text-3xl font-['Cormorant_Garamond'] font-semibold border-4 border-[#F9F4EB] shadow-lg">
                                {initials}
                            </div>
                        </div>
                    </div>

                    <div className="pt-20 p-6 md:p-10">
                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8 border-b border-[#1A1A1A]/10 pb-6">
                            <div>
                                <h2 className="text-2xl md:text-3xl font-['Cormorant_Garamond'] font-semibold">
                                    Personal Information
                                </h2>
                                <p className="text-[#1A1A1A]/60 mt-1">
                                    Update the profile details connected to your Supabase account.
                                </p>
                            </div>

                            {!isEditing ? (
                                <button
                                    type="button"
                                    onClick={() => setIsEditing(true)}
                                    className="px-6 py-3 text-base font-semibold border border-[#1A1A1A]/20 rounded-2xl hover:bg-[#F9F4EB] transition-colors"
                                >
                                    Edit Profile
                                </button>
                            ) : (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCancelEdit}
                                        disabled={saving}
                                        className="px-6 py-3 text-base font-semibold border border-[#1A1A1A]/20 rounded-2xl hover:bg-[#F9F4EB] transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleSaveProfile}
                                        disabled={saving}
                                        className="px-6 py-3 text-base font-semibold bg-[#1A1A1A] text-[#F9F4EB] rounded-2xl hover:bg-[#C58F3B] transition-colors disabled:opacity-50"
                                    >
                                        {saving ? "Saving..." : "Save Changes"}
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="space-y-7 max-w-2xl">
                            <div>
                                <label className="block text-sm font-bold tracking-wider uppercase text-[#1A1A1A]/50 mb-2">
                                    Account Email Address
                                </label>

                                <input
                                    type="email"
                                    value={userEmail}
                                    disabled
                                    className="w-full p-4 text-lg bg-[#F9F4EB]/70 border border-[#1A1A1A]/10 rounded-2xl text-[#1A1A1A]/60 cursor-not-allowed"
                                />

                                <p className="text-sm text-[#1A1A1A]/45 mt-2">
                                    Email is connected to Supabase Auth and cannot be changed from this page.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold tracking-wider uppercase text-[#1A1A1A]/50 mb-2">
                                    Full Name
                                </label>

                                <input
                                    type="text"
                                    value={formData.fullName}
                                    onChange={(event) =>
                                        setFormData({
                                            ...formData,
                                            fullName: event.target.value,
                                        })
                                    }
                                    disabled={!isEditing}
                                    placeholder="Enter full name"
                                    className={`w-full p-4 text-lg rounded-2xl border transition-colors ${isEditing
                                            ? "bg-white border-[#C58F3B] focus:outline-none focus:ring-2 focus:ring-[#C58F3B]/30"
                                            : "bg-[#F9F4EB]/70 border-[#1A1A1A]/10 text-[#1A1A1A]"
                                        }`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold tracking-wider uppercase text-[#1A1A1A]/50 mb-2">
                                    Phone Number
                                </label>

                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(event) =>
                                        setFormData({
                                            ...formData,
                                            phone: event.target.value,
                                        })
                                    }
                                    disabled={!isEditing}
                                    placeholder="Enter phone number"
                                    className={`w-full p-4 text-lg rounded-2xl border transition-colors ${isEditing
                                            ? "bg-white border-[#C58F3B] focus:outline-none focus:ring-2 focus:ring-[#C58F3B]/30"
                                            : "bg-[#F9F4EB]/70 border-[#1A1A1A]/10 text-[#1A1A1A]"
                                        }`}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}