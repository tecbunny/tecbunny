import { PageLoader } from '@/components/shared/LoadingSpinner';

export default function ManagementLoading() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <PageLoader />
    </div>
  );
}
