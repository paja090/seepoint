import { notFound } from 'next/navigation';
import { getPrintJobByToken } from '../../actions';
import { PrintApprovalClient } from './PrintApprovalClient';

export default async function PrintApprovalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  // For demo purposes, we will mock the response if the token is the demo token
  // This allows us to see the UI before connecting all database pieces.
  let job: any = null;

  if (token === 'demo-token-123') {
    job = {
      id: 'demo',
      title: 'Podzimní kampaň 2026',
      clientName: 'Alza.cz a.s.',
      formatType: 'EUROBILLBOARD',
      materialType: 'BLUEBACK_120G',
      quantity: 10,
      sparesQuantity: 2,
      deliveryDeadline: new Date('2026-10-15T00:00:00Z'),
      status: 'CLIENT_APPROVAL',
      artworkUrl: null, 
      organization: {
        name: 'Seepoint CZ',
        logoUrl: null,
        primaryColor: '#2563eb'
      }
    };
  } else {
    job = await getPrintJobByToken(token);
    if (!job) {
      notFound();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-6 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-lg bg-blue-600 text-white flex items-center justify-center font-bold text-xl shadow-sm">
                S
             </div>
             <div>
                <h1 className="text-xl font-bold text-gray-900">{job.organization?.name || 'Reklamní Agentura'}</h1>
                <p className="text-xs text-gray-500 font-medium">Schvalovací portál tiskových dat</p>
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 py-8 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <PrintApprovalClient job={job} token={token} />
        </div>
      </main>

      <footer className="bg-white border-t border-gray-200 py-6 text-center text-sm text-gray-500">
        <p>Provozováno platformou <strong>Seepoint</strong> - B2B Media Network & Production</p>
      </footer>
    </div>
  );
}
