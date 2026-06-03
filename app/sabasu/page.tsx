'use client'
export const dynamic = 'force-dynamic'

import { useState, useRef, FormEvent } from 'react'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// ─── DESIGN TOKENS ───
const BG = '#F9F4EB'
const BLACK = '#1A1A1A'
const GOLD = '#C58F3B'
const WHITE = '#FFFFFF'
const BODY = "'Inter', system-ui, sans-serif"
const DSP = "'Cormorant Garamond', Georgia, serif"

const INPUT: React.CSSProperties = {
    display: 'block', width: '100%', height: 50, padding: '0 15px', backgroundColor: WHITE,
    border: '1px solid rgba(26,26,26,0.14)', borderRadius: 8, fontSize: 15, color: BLACK,
    fontFamily: BODY, outline: 'none'
}

// ─── EXACT MENU FROM SABASU IMAGES ───
const MENU = {
    coffee: [
        { name: 'Sabasu Signature', hot: 145, iced: 165 },
        { name: 'Sabasu Brew', hot: 120, iced: 135 },
        { name: 'Flat White', hot: 130, iced: 145 },
        { name: 'Vanilla', hot: 140, iced: 155 },
        { name: 'Caramel', hot: 140, iced: 155 },
        { name: 'Hazelnut', hot: 140, iced: 155 },
        { name: 'Mocha', hot: 145, iced: 160 },
        { name: 'Spanish Latte', hot: 145, iced: 160 },
    ],
    non_coffee: [
        { name: 'Matcha', hot: 140, iced: 155 },
        { name: 'Choco', hot: 140, iced: 155 },
        { name: 'Dirty Matcha', hot: 150, iced: 165 },
        { name: 'Strawberry Matcha', icedOnly: 160 },
        { name: 'Strawberry Latte', icedOnly: 160 },
    ],
    pasta: [
        { name: 'Tuna Pesto', price: 180 },
        { name: 'Spanish Sardines', price: 180 },
        { name: 'Garlic Butter', price: 150 },
        { name: 'Creamy Mushroom', price: 150 },
    ],
    pastries: [
        { name: 'Chocolate Chip Cookie', price: 65 },
        { name: 'Fudgy Brownie', price: 65 },
    ]
}

interface CartItem { id: string; name: string; variant: string; price: number; qty: number }

export default function SabasuMenu() {
    const supabaseRef = useRef<SupabaseClient | null>(null)
    if (!supabaseRef.current) {
        supabaseRef.current = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
    }
    const supabase = supabaseRef.current

    const [cart, setCart] = useState<CartItem[]>([])
    const [name, setName] = useState('')
    const [location, setLocation] = useState('')
    const [loading, setLoading] = useState(false)
    const [submitted, setSubmitted] = useState(false)

    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.qty), 0)
    const isValid = name.length > 2 && location.length > 2 && cart.length > 0

    const addToCart = (itemName: string, variant: string, price: number) => {
        setCart(prev => {
            const existing = prev.find(i => i.name === itemName && i.variant === variant)
            if (existing) {
                return prev.map(i => i.name === itemName && i.variant === variant ? { ...i, qty: i.qty + 1 } : i)
            }
            return [...prev, { id: crypto.randomUUID(), name: itemName, variant, price, qty: 1 }]
        })
    }

    const removeFromCart = (id: string) => {
        setCart(prev => prev.filter(i => i.id !== id))
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault()
        if (!isValid || loading) return
        setLoading(true)

        const orderText = cart.map(i => `${i.qty}x ${i.name} ${i.variant !== 'Regular' ? `(${i.variant})` : ''}`).join(', ')

        try {
            const { error } = await supabase.from('sabasu_orders').insert({
                id: crypto.randomUUID(),
                client_name: name.trim(),
                location: location.trim(),
                items: orderText,
                total_amount: totalAmount,
                status: 'Pending'
            })
            if (error) throw new Error(error.message)
            setSubmitted(true)
        } catch (err) {
            alert("Failed to send order. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (submitted) return (
        <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '100px 20px', textAlign: 'center', fontFamily: BODY }}>
            <div style={{ fontSize: 44, color: GOLD, margin: '0 auto 22px', width: 70, height: 70, borderRadius: '50%', backgroundColor: 'rgba(197,143,59,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</div>
            <h2 style={{ fontFamily: DSP, fontSize: 40, color: BLACK, margin: '0 0 14px' }}>Order Sent to Kitchen</h2>
            <p style={{ color: 'rgba(26,26,26,0.7)', fontSize: 16, maxWidth: 450, margin: '0 auto 24px', lineHeight: 1.6 }}>
                Thank you, <strong style={{ color: BLACK }}>{name}</strong>! Your SABASU order is being prepared and will be delivered to <strong style={{ color: GOLD }}>{location}</strong>.
            </p>
            <button onClick={() => window.location.reload()} style={{ height: 50, padding: '0 32px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 10, fontSize: 12, fontWeight: 700, textTransform: 'uppercase', cursor: 'pointer' }}>Order More</button>
        </div>
    )

    const renderDrinkMenu = (items: any[]) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {items.map(i => (
                <div key={i.name} style={{ backgroundColor: WHITE, padding: 20, borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <h4 style={{ fontFamily: DSP, fontSize: 20, color: BLACK, margin: '0 0 16px' }}>{i.name}</h4>
                    <div style={{ display: 'flex', gap: 10 }}>
                        {i.hot && <button onClick={() => addToCart(i.name, 'Hot', i.hot)} style={{ flex: 1, padding: '8px 0', backgroundColor: '#FDFCF8', border: '1px solid rgba(197,143,59,0.3)', color: GOLD, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>HOT ₱{i.hot}</button>}
                        {i.iced && <button onClick={() => addToCart(i.name, 'Iced', i.iced)} style={{ flex: 1, padding: '8px 0', backgroundColor: 'rgba(197,143,59,0.05)', border: '1px solid rgba(197,143,59,0.3)', color: GOLD, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>ICED ₱{i.iced}</button>}
                        {i.icedOnly && <button onClick={() => addToCart(i.name, 'Iced', i.icedOnly)} style={{ flex: 1, padding: '8px 0', backgroundColor: 'rgba(197,143,59,0.05)', border: '1px solid rgba(197,143,59,0.3)', color: GOLD, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>ICED ₱{i.icedOnly}</button>}
                    </div>
                </div>
            ))}
        </div>
    )

    const renderFoodMenu = (items: any[]) => (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {items.map(i => (
                <div key={i.name} style={{ backgroundColor: WHITE, padding: 20, borderRadius: 12, border: '1px solid rgba(26,26,26,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h4 style={{ fontFamily: DSP, fontSize: 20, color: BLACK, margin: 0 }}>{i.name}</h4>
                    <button onClick={() => addToCart(i.name, 'Regular', i.price)} style={{ padding: '8px 16px', backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ ₱{i.price}</button>
                </div>
            ))}
        </div>
    )

    return (
        <div style={{ backgroundColor: BG, minHeight: '100dvh', padding: '60px 20px', fontFamily: BODY }}>
            <div style={{ maxWidth: 1000, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: 32 }}>

                {/* LEFT SIDE: MENU */}
                <div style={{ flex: '1 1 600px' }}>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <h1 style={{ fontFamily: DSP, fontSize: 44, color: BLACK, margin: '0 0 8px', letterSpacing: '0.05em' }}>SABASU</h1>
                        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.20em', color: GOLD, textTransform: 'uppercase', margin: 0 }}>Coffee & Pastries</p>
                    </div>

                    <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginBottom: 16 }}>Kape (Coffee)</h3>
                    {renderDrinkMenu(MENU.coffee)}

                    <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginTop: 40, marginBottom: 16 }}>Non-Coffee</h3>
                    {renderDrinkMenu(MENU.non_coffee)}

                    <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginTop: 40, marginBottom: 16 }}>Pasta</h3>
                    {renderFoodMenu(MENU.pasta)}

                    <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.1em', color: '#888', textTransform: 'uppercase', marginTop: 40, marginBottom: 16 }}>Pastries</h3>
                    {renderFoodMenu(MENU.pastries)}
                </div>

                {/* RIGHT SIDE: CART & CHECKOUT */}
                <div style={{ flex: '1 1 300px' }}>
                    <div style={{ position: 'sticky', top: 40, backgroundColor: WHITE, padding: 32, borderRadius: 16, border: '1px solid rgba(26,26,26,0.1)', boxShadow: '0 12px 40px rgba(0,0,0,0.05)' }}>
                        <h2 style={{ fontFamily: DSP, fontSize: 28, color: BLACK, margin: '0 0 24px', borderBottom: '1px solid rgba(197,143,59,0.2)', paddingBottom: 12 }}>Your Tray</h2>

                        {cart.length === 0 ? (
                            <p style={{ color: '#888', fontSize: 14, fontStyle: 'italic', marginBottom: 24 }}>Your tray is empty.</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                                {cart.map(item => (
                                    <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: BLACK, display: 'block' }}>{item.qty}x {item.name}</span>
                                            <span style={{ fontSize: 11, color: '#666' }}>{item.variant}</span>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                            <span style={{ fontSize: 14, fontWeight: 700, color: GOLD }}>₱{(item.price * item.qty).toLocaleString()}</span>
                                            <button onClick={() => removeFromCart(item.id)} style={{ background: 'none', border: 'none', color: '#C83232', fontSize: 18, cursor: 'pointer', padding: 0 }}>&times;</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, paddingTop: 16, borderTop: '1px dashed rgba(26,26,26,0.2)' }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: '#666', textTransform: 'uppercase' }}>Total Due</span>
                            <span style={{ fontSize: 24, fontWeight: 700, color: BLACK }}>₱{totalAmount.toLocaleString()}</span>
                        </div>

                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Client Name</label>
                                <input style={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Maria" required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', marginBottom: 6 }}>Location for Delivery</label>
                                <input style={INPUT} value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. Waiting Area / VIP Room 1" required />
                            </div>
                            <button type="submit" disabled={!isValid || loading} style={{ height: 54, backgroundColor: BLACK, color: GOLD, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', cursor: !isValid ? 'not-allowed' : 'pointer', opacity: !isValid ? 0.5 : 1, marginTop: 8 }}>
                                {loading ? 'Sending to Kitchen...' : 'Send Order'}
                            </button>
                        </form>

                    </div>
                </div>

            </div>
        </div>
    )
}