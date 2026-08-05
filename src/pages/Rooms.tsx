import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { useAuthStore } from '../store/authStore';
import { Plus, Trash2, Edit2, X, Lock } from 'lucide-react';

interface Room {
  id: string;
  roomNumber: string;
  capacity: number;
}

const Rooms: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = useAuthStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  // Form states
  const [roomNumber, setRoomNumber] = useState('');
  const [capacity, setCapacity] = useState(1);

  // Fetch Rooms
  const { data: roomsRes, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => api.get('/rooms').then((res) => res.data),
  });

  const rooms: Room[] = roomsRes?.data || [];

  // Create Room Mutation
  const createRoomMutation = useMutation({
    mutationFn: (newRoom: Omit<Room, 'id'>) => api.post('/rooms', newRoom),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      closeModal();
    },
  });

  // Edit Room Mutation
  const editRoomMutation = useMutation({
    mutationFn: (updatedRoom: { id: string; data: Partial<Room> }) =>
      api.put(`/rooms/${updatedRoom.id}`, updatedRoom.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      closeModal();
    },
  });

  // Delete Room Mutation
  const deleteRoomMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/rooms/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });

  const openModal = (room: Room | null = null) => {
    setSelectedRoom(room);
    if (room) {
      setRoomNumber(room.roomNumber);
      setCapacity(room.capacity);
    } else {
      setRoomNumber('');
      setCapacity(1);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedRoom(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      roomNumber,
      capacity: Number(capacity),
    };

    if (selectedRoom) {
      editRoomMutation.mutate({ id: selectedRoom.id, data: payload });
    } else {
      createRoomMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this room? This action is permanent.')) {
      deleteRoomMutation.mutate(id);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400">Configure and update hotel accommodations</p>
        </div>
        {hasPermission('rooms.create') && (
          <button
            onClick={() => openModal()}
            className="flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 text-sm transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Room
          </button>
        )}
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Fetching rooms inventory...</div>
      ) : (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-850 text-slate-300 text-xs uppercase tracking-wider font-semibold">
                <th className="p-4">Room #</th>
                <th className="p-4">Capacity</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-sm text-slate-250">
              {rooms.map((room) => (
                <tr key={room.id} className="hover:bg-slate-850/50 transition-colors">
                  <td className="p-4 font-mono font-bold text-white">Room {room.roomNumber}</td>
                  <td className="p-4">{room.capacity} Guests</td>
                  <td className="p-4 text-right space-x-2">
                    {hasPermission('rooms.update') && (
                      <button
                        onClick={() => openModal(room)}
                        className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer inline-flex"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    )}
                    {hasPermission('rooms.delete') ? (
                      <button
                        onClick={() => handleDelete(room.id)}
                        className="p-1.5 hover:bg-rose-950/45 text-rose-400 hover:text-rose-200 rounded-lg transition-colors cursor-pointer inline-flex"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    ) : (
                      <span className="p-1.5 text-slate-650 inline-flex cursor-not-allowed">
                        <Lock className="w-4 h-4" />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Editor Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal} />
          
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl p-6 z-10 my-8 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-5">
              <h3 className="text-lg font-bold text-white">
                {selectedRoom ? `Edit Room ${selectedRoom.roomNumber}` : 'Add New Room'}
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
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Room Number</label>
                <input
                  type="text"
                  required
                  value={roomNumber}
                  onChange={(e) => setRoomNumber(e.target.value)}
                  placeholder="e.g. 104"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">Capacity (Guests)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={capacity}
                  onChange={(e) => setCapacity(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
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
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Rooms;
