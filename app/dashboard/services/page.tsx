import { getServices } from '@/lib/actions/services';
import { Sparkles, Clock, Tag, CheckCircle2 } from 'lucide-react';

export default async function ServicesPage() {
  const services = await getServices();

  // Group by category
  const groupedServices = services?.reduce((acc: any, service: any) => {
    const category = service.category || 'Other';
    if (!acc[category]) acc[category] = [];
    acc[category].push(service);
    return acc;
  }, {}) || {};

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h1 className="brand-heading text-4xl">Wellness Services</h1>
          <p className="text-brandAccent/60">Menu of healing and rejuvenation treatments.</p>
        </div>
      </div>
      {services && services.length > 0 ? (
        Object.keys(groupedServices).sort((a, b) => {
          const order = ['Massage Services', 'Le Nails Salon'];
          const aIndex = order.indexOf(a);
          const bIndex = order.indexOf(b);
          if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
          if (aIndex !== -1) return -1;
          if (bIndex !== -1) return 1;
          return a.localeCompare(b);
        }).map(category => (
          <div key={category} className="space-y-4">
            <div className="flex items-center gap-2 px-1">
              <Tag size={16} className="text-brandAccent" />
              <h2 className="brand-heading text-xl tracking-tight">{category}</h2>
              <div className="flex-1 h-px bg-brandAccent/10 ml-4"></div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groupedServices[category].map((service: any) => (
                <div key={service.id} className="brand-card group hover:border-brandAccent/40 transition-all flex flex-col justify-between">
                  <div className="space-y-3">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-brandAccent text-lg leading-tight group-hover:text-brandAccent transition-colors">
                        {service.service_name}
                      </h3>
                      <div className="p-1.5 bg-emerald-500/10 text-emerald-600 rounded-full">
                        <CheckCircle2 size={14} />
                      </div>
                    </div>
                    <p className="text-xs text-brandAccent/50 line-clamp-2 italic font-medium leading-relaxed">
                      {service.description || 'A signature Sabbath wellness treatment.'}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-brandAccent/5 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-brandAccent/70">
                      <Clock size={14} className="text-brandAccent/30" />
                      {service.duration_minutes}m
                    </div>
                    <div className="text-sm font-display font-bold text-brandAccent">
                      ₱{service.price?.toLocaleString('en-PH', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="brand-card p-20 text-center">
          <div className="space-y-3">
            <div className="text-brandAccent/20">
              <Sparkles size={48} className="mx-auto" />
            </div>
            <p className="text-sm font-bold text-brandAccent/40">No services found. Add services in Supabase or setup.</p>
          </div>
        </div>
      )}
    </div>
  );
}