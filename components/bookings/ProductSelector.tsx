'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, Search } from 'lucide-react';

interface Product {
    id: string;
    name: string;
    price: number;
    category: string;
}

export interface CartItem {
    product_id: string;
    name: string;
    unit_price: number;
    quantity: number;
}

interface Props {
    products: Product[];
    onChange: (items: CartItem[]) => void;
    initialItems?: CartItem[];
}

export default function ProductSelector({ products, onChange, initialItems }: Props) {
    const [cart, setCart] = useState<CartItem[]>(initialItems ?? []);
    const [search, setSearch] = useState('');

    // Sync if parent loads initialItems asynchronously (e.g. editing an existing booking)
    useEffect(() => {
        if (initialItems && initialItems.length > 0) {
            setCart(initialItems);
        }
    }, [initialItems]);

    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

    const updateCart = (next: CartItem[]) => {
        setCart(next);
        onChange(next);
    };

    const addItem = (product: Product) => {
        const existing = cart.find(i => i.product_id === product.id);
        if (existing) {
            updateCart(cart.map(i =>
                i.product_id === product.id
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
            ));
        } else {
            updateCart([...cart, {
                product_id: product.id,
                name: product.name,
                unit_price: product.price,
                quantity: 1,
            }]);
        }
    };

    const changeQty = (product_id: string, delta: number) => {
        const next = cart
            .map(i => i.product_id === product_id ? { ...i, quantity: i.quantity + delta } : i)
            .filter(i => i.quantity > 0);
        updateCart(next);
    };

    const removeItem = (product_id: string) => {
        updateCart(cart.filter(i => i.product_id !== product_id));
    };

    const cartTotal = cart.reduce((s, i) => s + i.unit_price * i.quantity, 0);
    const fmt = (n: number) => `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <ShoppingBag size={16} className="text-brandAccent" />
                <h3 className="font-bold text-sm uppercase tracking-widest text-brandAccent">
                    Food & Drinks
                </h3>
                {cart.length > 0 && (
                    <span className="ml-auto text-xs font-bold text-emerald-600">
                        {cart.reduce((s, i) => s + i.quantity, 0)} item(s) · {fmt(cartTotal)}
                    </span>
                )}
            </div>

            {/* Search */}
            <div className="relative">
                <input
                    type="text"
                    placeholder="Search products..."
                    className="input h-10 pl-9 text-sm"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brandAccent/40" />
            </div>

            {/* Product Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-56 overflow-y-auto pr-1">
                {filtered.map(product => {
                    const inCart = cart.find(i => i.product_id === product.id);
                    return (
                        <button
                            key={product.id}
                            type="button"
                            onClick={() => addItem(product)}
                            className={`p-3 rounded-base border-2 text-left transition-all space-y-1 ${inCart
                                ? 'border-brandAccent bg-brandAccent/5'
                                : 'border-brandAccent/20 hover:border-brandAccent/50'
                                }`}
                        >
                            <div className="text-xs font-bold text-brandAccent leading-tight truncate">
                                {product.name}
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] text-brandAccent/50">{fmt(product.price)}</span>
                                {inCart && (
                                    <span className="text-[9px] font-bold bg-brandAccent text-white px-1.5 py-0.5 rounded-full">
                                        ×{inCart.quantity}
                                    </span>
                                )}
                            </div>
                        </button>
                    );
                })}
                {filtered.length === 0 && (
                    <div className="col-span-3 py-6 text-center text-xs text-brandAccent/40 italic">
                        No products found.
                    </div>
                )}
            </div>

            {/* Cart */}
            {cart.length > 0 && (
                <div className="border border-brandAccent/10 rounded-base overflow-hidden">
                    <div className="px-4 py-2 bg-brandBackground/50 text-[9px] uppercase tracking-widest font-bold text-brandAccent/50">
                        Order Summary
                    </div>
                    <div className="divide-y divide-brandAccent/5">
                        {cart.map(item => (
                            <div key={item.product_id} className="flex items-center gap-3 px-4 py-2.5">
                                <span className="flex-1 text-xs font-bold text-brandAccent truncate">
                                    {item.name}
                                </span>
                                <span className="text-[10px] text-brandAccent/50 w-16 text-right">
                                    {fmt(item.unit_price)}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => changeQty(item.product_id, -1)}
                                        className="w-5 h-5 rounded-full border border-brandAccent/20 flex items-center justify-center hover:border-brandAccent transition-colors">
                                        <Minus size={10} className="text-brandAccent" />
                                    </button>
                                    <span className="text-xs font-bold w-5 text-center">{item.quantity}</span>
                                    <button type="button" onClick={() => changeQty(item.product_id, 1)}
                                        className="w-5 h-5 rounded-full border border-brandAccent/20 flex items-center justify-center hover:border-brandAccent transition-colors">
                                        <Plus size={10} className="text-brandAccent" />
                                    </button>
                                </div>
                                <span className="text-xs font-bold text-brandAccent w-16 text-right">
                                    {fmt(item.unit_price * item.quantity)}
                                </span>
                                <button type="button" onClick={() => removeItem(item.product_id)}
                                    className="text-red-400 hover:text-red-600 transition-colors">
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 bg-brandAccent/5 border-t border-brandAccent/10">
                        <span className="text-[10px] uppercase tracking-widest font-bold text-brandAccent/60">
                            F&B Subtotal
                        </span>
                        <span className="text-sm font-bold text-brandAccent">{fmt(cartTotal)}</span>
                    </div>
                </div>
            )}
        </div>
    );
}