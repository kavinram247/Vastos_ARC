import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useStore } from '../hooks/useStore';
import { usePermissions } from '../hooks/usePermissions';
import { ProjectSubPageHeader } from '../components/ProjectSubPageHeader';
import type { Page } from '../types';
import { Card, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { formatINR, formatINRCompact, formatDate } from '../utils/format';
import {
  Plus, TrendingUp, TrendingDown, Package, Wrench, Users,
  Receipt,
} from 'lucide-react';

interface Props {
  projectId: string;
  onNavigate: (page: Page, projectId?: string) => void;
}

const categoryIcons = {
  materials: Package,
  labour: Users,
  vendor: Wrench,
};



export function CostsPage({ projectId, onNavigate }: Props) {
  const { user, firm } = useAuth();
  const store = useStore();
  const { can } = usePermissions();
  const [showAddModal, setShowAddModal] = useState(false);

  if (!user || !firm) return null;

  const data = store.forFirm(firm.id);
  const selectedProject = projectId;

  const costs = data.costEntries
    .filter(c => c.project_id === selectedProject)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const received = data.paymentsReceived
    .filter(p => p.project_id === selectedProject)
    .reduce((sum, p) => sum + p.amount, 0);

  const totalCosts = costs.reduce((s, c) => s + c.amount, 0);
  const materialsCost = costs.filter(c => c.category === 'materials').reduce((s, c) => s + c.amount, 0);
  const labourCost = costs.filter(c => c.category === 'labour').reduce((s, c) => s + c.amount, 0);
  const vendorCost = costs.filter(c => c.category === 'vendor').reduce((s, c) => s + c.amount, 0);
  const profit = received - totalCosts;

  const getProfile = (id: string) => data.profiles.find(p => p.id === id);

  return (
    <div className="space-y-6">
      <ProjectSubPageHeader projectId={projectId} title="Costs & Profit" subtitle="Track vendor, labour & material expenses" onNavigate={onNavigate}>
        {can('costs', 'create') && (
          <Button size="sm" onClick={() => setShowAddModal(true)}>
            <Plus className="w-4 h-4" /> Add Cost
          </Button>
        )}
      </ProjectSubPageHeader>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Received</span>
          <div className="text-xl font-bold text-emerald-600">{formatINRCompact(received)}</div>
        </Card>
        <Card className="space-y-1">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Total Costs</span>
          <div className="text-xl font-bold text-red-600">{formatINRCompact(totalCosts)}</div>
        </Card>
        <Card className={`space-y-1 ${profit >= 0 ? 'border-emerald-200' : 'border-red-200'}`}>
          <div className="flex items-center gap-1">
            {profit >= 0 ? <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> : <TrendingDown className="w-3.5 h-3.5 text-red-500" />}
            <span className="text-xs text-slate-500 uppercase tracking-wide font-medium">Profit</span>
          </div>
          <div className={`text-xl font-bold ${profit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {formatINR(profit)}
          </div>
        </Card>
        <Card className="col-span-2">
          <span className="text-xs text-slate-500 uppercase tracking-wide font-medium mb-2 block">Cost Breakdown</span>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-xs text-slate-600">Materials {formatINRCompact(materialsCost)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-amber-500" />
              <span className="text-xs text-slate-600">Labour {formatINRCompact(labourCost)}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm bg-purple-500" />
              <span className="text-xs text-slate-600">Vendor {formatINRCompact(vendorCost)}</span>
            </div>
          </div>
          {totalCosts > 0 && (
            <div className="flex h-3 rounded-full overflow-hidden mt-2">
              <div className="bg-blue-500" style={{ width: `${(materialsCost / totalCosts) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(labourCost / totalCosts) * 100}%` }} />
              <div className="bg-purple-500" style={{ width: `${(vendorCost / totalCosts) * 100}%` }} />
            </div>
          )}
        </Card>
      </div>

      {/* Cost Entries Table */}
      <Card padding="none">
        <div className="p-4 border-b border-slate-200">
          <CardTitle>Cost Entries</CardTitle>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Category</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Vendor</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Amount</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Added By</th>
              </tr>
            </thead>
            <tbody>
              {costs.map(cost => {
                const Icon = categoryIcons[cost.category];
                const addedBy = getProfile(cost.created_by);
                return (
                  <tr key={cost.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatDate(cost.date)}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline" size="sm">
                        <Icon className="w-3 h-3 mr-1" />
                        {cost.category.charAt(0).toUpperCase() + cost.category.slice(1)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-slate-900 font-medium">{cost.description}</td>
                    <td className="px-4 py-3 text-slate-500">{cost.vendor_name || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatINR(cost.amount)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{addedBy?.full_name || 'Unknown'}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-slate-700">Total</td>
                <td className="px-4 py-3 text-right text-slate-900">{formatINR(totalCosts)}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {costs.length === 0 && (
        <div className="text-center py-12">
          <Receipt className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">No cost entries logged yet.</p>
        </div>
      )}

      {/* Add Cost Modal */}
      <AddCostModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        firmId={firm.id}
        projectId={selectedProject}
        userId={user.id}
      />
    </div>
  );
}

function AddCostModal({
  open, onClose, firmId, projectId, userId,
}: {
  open: boolean;
  onClose: () => void;
  firmId: string;
  projectId: string;
  userId: string;
}) {
  const store = useStore();
  const [form, setForm] = useState({
    category: 'materials' as 'materials' | 'labour' | 'vendor',
    description: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    vendor_name: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.description || !form.amount) return;
    store.addCostEntry({
      firm_id: firmId,
      project_id: projectId,
      category: form.category,
      description: form.description,
      amount: parseFloat(form.amount),
      date: form.date,
      vendor_name: form.vendor_name || undefined,
      created_by: userId,
    });
    setForm({ category: 'materials', description: '', amount: '', date: new Date().toISOString().split('T')[0], vendor_name: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Cost Entry">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Category"
          value={form.category}
          onChange={e => setForm(f => ({ ...f, category: e.target.value as any }))}
          options={[
            { value: 'materials', label: '📦 Materials' },
            { value: 'labour', label: '👷 Labour' },
            { value: 'vendor', label: '🔧 Vendor / Contractor' },
          ]}
        />
        <Textarea label="Description" required value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g., TMT Steel Bars – 25 tonnes" rows={2} />
        <Input label="Amount (₹)" required type="number" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="450000" />
        <Input label="Date" required type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
        <Input label="Vendor / Supplier Name" value={form.vendor_name} onChange={e => setForm(f => ({ ...f, vendor_name: e.target.value }))} placeholder="Optional" />
        <div className="flex justify-end gap-3 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>Cancel</Button>
          <Button type="submit">
            <Plus className="w-4 h-4" /> Add Entry
          </Button>
        </div>
      </form>
    </Modal>
  );
}
