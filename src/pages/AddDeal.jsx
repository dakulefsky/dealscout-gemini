import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import AddDealCard from '@/components/admin/AddDealCard';

export default function AddDeal() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <Link to="/admin" className="inline-flex items-center gap-1 text-sm font-bold text-slate-600 hover:text-slate-900"><ArrowLeft className="w-4 h-4" /> Admin</Link>
      <AddDealCard />
    </div>
  );
}
