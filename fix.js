const fs = require('fs');

const clientsPagePath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/app/dashboard/clients/page.tsx';
const clientsPageContent = `import { getClients } from '@/lib/actions/clients';
import ClientList from '@/components/clients/ClientList';

export default async function ClientsPage() {
  const clients = await getClients();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="brand-heading text-3xl">Client Management</h1>
        <p className="text-brandAccent/60 text-sm mt-1">
          View and manage your client database.
        </p>
      </div>
      <ClientList initialClients={clients} />
    </div>
  );
}`;
fs.writeFileSync(clientsPagePath, clientsPageContent);

const profilePath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/app/dashboard/clients/[id]/page.tsx';
let profileCode = fs.readFileSync(profilePath, 'utf8');
profileCode = profileCode.replace(
  "const { id } = await params;",
  "const { id } = await params;\n  if (!id) return <div className=\"p-8 text-center text-brandAccent/60\">Invalid client ID</div>;"
);
fs.writeFileSync(profilePath, profileCode);

const clientsActionsPath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/lib/actions/clients.ts';
let clientsActionsCode = fs.readFileSync(clientsActionsPath, 'utf8');
clientsActionsCode = clientsActionsCode.replace(
  "export async function getClientById(id: string) {",
  "export async function getClientById(id: string) {\n  if (!id) return null;"
);
fs.writeFileSync(clientsActionsPath, clientsActionsCode);

const waiversActionsPath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/lib/actions/waivers.ts';
let waiversActionsCode = fs.readFileSync(waiversActionsPath, 'utf8');
waiversActionsCode = waiversActionsCode.replace(
  "export async function getWaiversByClient(clientId: string) {",
  "export async function getWaiversByClient(clientId: string) {\n    if (!clientId) return [];"
);
fs.writeFileSync(waiversActionsPath, waiversActionsCode);

console.log('All updates successful!');
