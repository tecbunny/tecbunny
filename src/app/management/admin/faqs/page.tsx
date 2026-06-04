import FaqsManagement from '@/components/admin/FaqsManagement';

export const metadata = {
  title: 'FAQ Management | Admin Dashboard',
};

export default function AdminFaqsPage() {
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">FAQ Management</h1>
        <p className="text-muted-foreground mt-2">
          Create, edit, and manage frequently asked questions.
        </p>
      </div>
      
      <FaqsManagement />
    </div>
  );
}
