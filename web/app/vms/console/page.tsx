"use client"
import dynamic from 'next/dynamic';
import { PageLayout } from '@/components/shared/page-layout';
import { getUrlParams, navigateTo, routes } from '@/lib/navigation';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

const VMSerialConsole = dynamic(
  () => import('@/components/vm-serial-console').then(mod => mod.VMSerialConsole),
  { ssr: false }
);

export default function ConsolePage() {
  const searchParams = getUrlParams();
  
  const vmUuid = searchParams.get('id'); // ✅ extract vmUuid safely

  if (!vmUuid) {
    return (
      <PageLayout
        title="Serial Console"
        description="VM ID is required to access the console"
      >
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-2">No VM Selected</h2>
            <p className="text-muted-foreground mb-4">Please select a VM to access its console</p>
            <Button onClick={() => navigateTo('/vms')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to VMs
            </Button>
          </div>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="Serial Console"
      description={`Connect to VM ${vmUuid.slice(0, 8)}... serial console for direct access`}
      actions={
        <Button 
          variant="outline" 
          onClick={() => navigateTo(routes.vmDetail(vmUuid))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to VM Details
        </Button>
      }
    >
      <VMSerialConsole vmUuid={vmUuid} />
    </PageLayout>
  );
}