import { PageLoader } from '@/components/shared/LoadingSpinner';

export default function RootLoading() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center bg-background">
      <PageLoader />
    </div>
  );
}
