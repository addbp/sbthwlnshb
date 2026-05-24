'use client';

import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    const supabase = createClient();
    if (supabase) {
      await supabase.auth.signOut();
      router.push('/login');
      router.refresh();
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="p-2 hover:bg-red-50 text-brandAccent/40 hover:text-red-600 rounded-base transition-colors"
      title="Logout"
    >
      <LogOut size={18} />
    </button>
  );
}
