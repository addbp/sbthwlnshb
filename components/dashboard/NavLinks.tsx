'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  BarChart3, 
  Users, 
  Calendar, 
  Settings, 
  FileText, 
  CreditCard, 
  Sparkles,
  LayoutDashboard
} from 'lucide-react';

export default function NavLinks() {
  const pathname = usePathname();

  const links = [
    { href: '/dashboard', icon: <LayoutDashboard size={18} />, label: 'Overview' },
    { href: '/dashboard/bookings', icon: <Calendar size={18} />, label: 'Bookings' },
    { href: '/dashboard/clients', icon: <Users size={18} />, label: 'Clients' },
    { href: '/dashboard/waivers', icon: <FileText size={18} />, label: 'Waivers' },
    { href: '/dashboard/services', icon: <Sparkles size={18} />, label: 'Services' },
    { href: '/dashboard/payments', icon: <CreditCard size={18} />, label: 'Payments' },
    { href: '/dashboard/reports', icon: <BarChart3 size={18} />, label: 'Reports' },
  ];

  return (
    <>
      <nav className="flex-1 px-4 space-y-1 mt-4">
        {links.map((link) => (
          <NavLink key={link.href} {...link} active={pathname === link.href || (link.href !== '/dashboard' && pathname.startsWith(link.href))} />
        ))}
      </nav>

      <div className="p-4 border-t border-brandAccent/10">
        <NavLink 
          href="/dashboard/settings" 
          icon={<Settings size={18} />} 
          label="Setup" 
          active={pathname.startsWith('/dashboard/settings')} 
        />
      </div>
    </>
  );
}

function NavLink({ href, icon, label, active }: { href: string, icon: React.ReactNode, label: string, active: boolean }) {
  return (
    <Link 
      href={href} 
      className={`sidebar-link group ${active ? 'sidebar-link-active' : ''}`}
    >
      <span className={`${active ? 'text-brandAccent' : 'text-brandAccent/60 group-hover:text-brandAccent'} transition-colors`}>{icon}</span>
      <span className="font-medium">{label}</span>
    </Link>
  );
}