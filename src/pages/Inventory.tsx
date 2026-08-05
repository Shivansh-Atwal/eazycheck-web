import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { Plus, Trash2, Edit2, X, AlertTriangle } from 'lucide-react';

interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
}

const Inventory: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(0);

  // Fetch Inventory
  const { data: inventoryRes, isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => api.get('/inventory').then((res) => res.data),
  });

  const items: InventoryItem[] = inventoryRes?.data || [];

  // Create Item Mutation
  const createItemMutation = useMutation({
    mutationFn: (newItem: Omit<InventoryItem, 'id'>) => api.post('/inventory', newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeModal();
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to create inventory item.');
    },
  });

  // Edit Item Mutation
  const editItemMutation = useMutation({
    mutationFn: (updatedItem: { id: string; data: Partial<InventoryItem> }) =>
      api.put(`/inventory/${updatedItem.id}`, updatedItem.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      closeModal();
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update inventory item.');
    },
  });

  // Quick Quantity Update Mutation
  const updateQuantityMutation = useMutation({
    mutationFn: (params: { id: string; quantity: number }) =>
      api.put(`/inventory/${params.id}`, { quantity: params.quantity }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update stock quantity.');
    },
  });

  // Delete Item Mutation
  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/inventory/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete inventory item.');
    },
  });

  const openModal = (item: InventoryItem | null = null) => {
    setSelectedItem(item);
    if (item) {
      setName(item.name);
      setQuantity(item.quantity);
    } else {
      setName('');
      setQuantity(0);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedItem(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert('Please enter a valid item name.');
      return;
    }
    const payload = {
      name: name.trim(),
      quantity: Number(quantity),
    };

    if (selectedItem) {
      editItemMutation.mutate({ id: selectedItem.id, data: payload });
    } else {
      createItemMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this inventory item? This will remove all stock records for it.')) {
      deleteItemMutation.mutate(id);
    }
  };

  const handleQuickAdjust = (item: InventoryItem, adjustment: number) => {
    const newQty = item.quantity + adjustment;
    // Set a baseline minimum of 0 (so we don't go negative manually via dashboard actions unless explicitly needed)
    const finalQty = newQty < 0 ? 0 : newQty;
    updateQuantityMutation.mutate({ id: item.id, quantity: finalQty });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 sm:justify-between sm:items-center border-b border-slate-800 pb-4">
        <div>
          <p className="text-sm text-slate-400">Track and update stock levels for room convenience items</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center justify-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 text-sm transition-colors cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </button>
      </div>

      {/* Responsive List / Table */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Fetching stock inventory...</div>
      ) : (
        <>
          {/* Mobile view (cards) */}
          <div className="md:hidden space-y-4">
            {items.length === 0 ? (
              <div className="p-8 text-center text-slate-500 italic bg-slate-900 border border-slate-800 rounded-2xl">
                No items in inventory. Click "Add Item" to initialize stock.
              </div>
            ) : (
              items.map((item) => {
                const isLow = item.quantity <= 5;
                const isOut = item.quantity === 0;

                return (
                  <div key={item.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3.5 shadow-md">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-white text-base">{item.name}</span>
                      <div>
                        {isOut ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" /> Out of Stock
                          </span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            Good Stock
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-950/45 p-3 rounded-xl border border-slate-850">
                      <span className="text-xs text-slate-400 font-semibold">Stock Quantity</span>
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => handleQuickAdjust(item, -1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-extrabold text-sm transition-colors cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-bold text-slate-100 min-w-[20px] text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => handleQuickAdjust(item, 1)}
                          className="w-7 h-7 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-extrabold text-sm transition-colors cursor-pointer"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        onClick={() => openModal(item)}
                        className="px-3 py-1.5 bg-slate-950 hover:bg-slate-900 text-slate-200 hover:text-white rounded-xl text-xs font-semibold border border-slate-700 transition-colors flex items-center gap-1.5"
                      >
                        <Edit2 className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="px-3 py-1.5 bg-rose-950/20 hover:bg-rose-950/45 text-rose-400 hover:text-rose-250 rounded-xl text-xs font-semibold border border-rose-900/30 transition-colors flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Desktop view (table) */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850 text-slate-300 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4">Item Name</th>
                  <th className="p-4">In Stock Quantity</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-250">
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500 italic">
                      No items in inventory. Click "Add Item" to initialize stock.
                    </td>
                  </tr>
                ) : (
                  items.map((item) => {
                    const isLow = item.quantity <= 5;
                    const isOut = item.quantity === 0;

                    return (
                      <tr key={item.id} className="hover:bg-slate-850/50 transition-colors">
                        <td className="p-4 font-semibold text-white">{item.name}</td>
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <button
                              onClick={() => handleQuickAdjust(item, -1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-extrabold text-sm transition-colors cursor-pointer"
                              title="Decrease Stock by 1"
                            >
                              -
                            </button>
                            <span className="font-mono font-bold text-base text-slate-100 min-w-[24px] text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuickAdjust(item, 1)}
                              className="w-7 h-7 flex items-center justify-center bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 font-extrabold text-sm transition-colors cursor-pointer"
                              title="Increase Stock by 1"
                            >
                              +
                            </button>
                          </div>
                        </td>
                        <td className="p-4">
                          {isOut ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> Out of Stock
                            </span>
                          ) : isLow ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                              <AlertTriangle className="w-3.5 h-3.5" /> Low Stock
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Good Stock
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-right space-x-2">
                          <button
                            onClick={() => openModal(item)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer inline-flex"
                            title="Edit Item"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1.5 hover:bg-rose-950/45 text-rose-400 hover:text-rose-200 rounded-lg transition-colors cursor-pointer inline-flex"
                            title="Delete Item"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal} />
          
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl p-6 z-10 my-8 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <h3 className="text-lg font-bold text-white">
                {selectedItem ? `Edit ${selectedItem.name}` : 'Add New Inventory Item'}
              </h3>
              <button
                onClick={closeModal}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Item Name</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Water Bottle, Tea"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Stock Quantity</label>
                <input
                  type="number"
                  required
                  min={0}
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none font-mono"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs shadow-lg shadow-blue-500/10 transition-colors cursor-pointer"
                >
                  Save Item
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
