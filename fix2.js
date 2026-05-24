const fs = require('fs');
const clientsPagePath = 'c:/Users/Nico/.gemini/antigravity/brain/Sabbath-System/app/dashboard/clients/page.tsx';
const clientsPageContent = `import ClientList from '@/components/clients/ClientList';

export default function ClientsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="brand-heading text-3xl">Client Management</h1>
        <p className="text-brandAccent/60 text-sm mt-1">
          View and manage your client database.
        </p>
      </div>
      <ClientList />
    </div>
  );
}`;
fs.writeFileSync(clientsPagePath, clientsPageContent);
console.log('Fixed');
