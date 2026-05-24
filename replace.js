const fs = require('fs');
const file = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/app/dashboard/clients/[id]/page.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace imports
code = code.replace(
  "import { getClientById } from '@/lib/actions/clients';\r\nimport Link from 'next/link';",
  "import { getClientById } from '@/lib/actions/clients';\r\nimport { getWaiversByClient } from '@/lib/actions/waivers';\r\nimport WaiverCard from '@/components/waivers/WaiverCard';\r\nimport Link from 'next/link';"
);
code = code.replace(
  "import { getClientById } from '@/lib/actions/clients';\nimport Link from 'next/link';",
  "import { getClientById } from '@/lib/actions/clients';\nimport { getWaiversByClient } from '@/lib/actions/waivers';\nimport WaiverCard from '@/components/waivers/WaiverCard';\nimport Link from 'next/link';"
);

// Fetch waivers
code = code.replace(
  "const { id } = await params;\r\n  const client = await getClientById(id);",
  "const { id } = await params;\r\n  const client = await getClientById(id);\r\n  const waivers = await getWaiversByClient(id);"
);
code = code.replace(
  "const { id } = await params;\n  const client = await getClientById(id);",
  "const { id } = await params;\n  const client = await getClientById(id);\n  const waivers = await getWaiversByClient(id);"
);

const oldLayout1 = `        <div className="lg:col-span-2 space-y-6">
          <HorizontalTabs />
        </div>`;
const oldLayout2 = oldLayout1.replace(/\n/g, '\r\n');

const newLayout = `        <div className="lg:col-span-2 space-y-6">
          {/* Digital Waivers Section */}
          <div className="brand-card p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-brandAccent/10 pb-2">
              <h3 className="brand-heading text-xl flex items-center gap-2">
                <FileText size={16} className="text-brandAccent/40" />
                Digital Waivers
              </h3>
              <Link href={\`/dashboard/clients/\${id}/waivers/new\`} className="btn-primary text-sm py-1.5 px-4">
                New Waiver
              </Link>
            </div>
            
            {waivers && waivers.length > 0 ? (
              <div className="space-y-4">
                {waivers.map((waiver: any) => (
                  <WaiverCard key={waiver.id} waiver={waiver} />
                ))}
              </div>
            ) : (
              <div className="p-8 text-center bg-brandPrimary/5 rounded-base border border-brandAccent/10">
                <FileText size={32} className="mx-auto text-brandAccent/20 mb-3" />
                <div className="text-brandAccent/60 font-bold mb-1">No waivers signed yet</div>
                <p className="text-xs text-brandAccent/40">This client has not signed any digital waivers.</p>
              </div>
            )}
          </div>

          {/* Booking History Placeholder */}
          <div className="brand-card p-6 space-y-6">
            <h3 className="brand-heading text-xl border-b border-brandAccent/10 pb-2 flex items-center gap-2">
              <Calendar size={16} className="text-brandAccent/40" />
              Booking History
            </h3>
            <div className="p-8 text-center bg-brandPrimary/5 rounded-base border border-brandAccent/10">
              <Clock size={32} className="mx-auto text-brandAccent/20 mb-3" />
              <div className="text-brandAccent/60 font-bold mb-1">No Data Available</div>
              <p className="text-xs text-brandAccent/40">This module will be activated in the next phase.</p>
            </div>
          </div>

          {/* Transactions Placeholder */}
          <div className="brand-card p-6 space-y-6">
            <h3 className="brand-heading text-xl border-b border-brandAccent/10 pb-2 flex items-center gap-2">
              <CreditCard size={16} className="text-brandAccent/40" />
              Transactions
            </h3>
            <div className="p-8 text-center bg-brandPrimary/5 rounded-base border border-brandAccent/10">
              <CreditCard size={32} className="mx-auto text-brandAccent/20 mb-3" />
              <div className="text-brandAccent/60 font-bold mb-1">No Data Available</div>
              <p className="text-xs text-brandAccent/40">This module will be activated in the next phase.</p>
            </div>
          </div>
        </div>`;

code = code.replace(oldLayout1, newLayout);
code = code.replace(oldLayout2, newLayout);

const horizontalTabsRegex = /function HorizontalTabs\(\) \{[\s\S]*?function TabItem[^}]+}[\s\S]*?}/g;
code = code.replace(horizontalTabsRegex, '');

fs.writeFileSync(file, code);
console.log('File updated successfully.');
