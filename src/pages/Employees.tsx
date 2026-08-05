import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../utils/api';
import { Plus, X, Shield, Lock, ShieldAlert, KeyRound } from 'lucide-react';

interface Employee {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isDisabled: boolean;
  permissions: string[];
  hasCustomPermissions: boolean;
}

interface Permission {
  id: string;
  name: string;
  description: string;
}

const Employees: React.FC = () => {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [pwdModalOpen, setPwdModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  // Password reset state
  const [newPassword, setNewPassword] = useState('');

  // Fetch Employees
  const { data: employeesRes, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => api.get('/admin/employees').then((res) => res.data),
  });

  // Fetch System Permissions List
  const { data: permissionsRes } = useQuery({
    queryKey: ['system-permissions'],
    queryFn: () => api.get('/admin/permissions').then((res) => res.data),
  });

  const employees: Employee[] = employeesRes?.data || [];
  const permissions: Permission[] = permissionsRes?.data || [];

  // Create Employee Mutation
  const createEmpMutation = useMutation({
    mutationFn: (newEmp: any) => api.post('/admin/employees', newEmp),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      closeModal();
    },
  });

  // Update Employee (Permissions / Name) Mutation
  const updateEmpMutation = useMutation({
    mutationFn: (updated: { id: string; data: any }) =>
      api.put(`/admin/employees/${updated.id}`, updated.data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      closeModal();
    },
  });

  // Disable / Enable Employee Mutation
  const toggleDisableMutation = useMutation({
    mutationFn: (data: { id: string; isDisabled: boolean }) =>
      api.patch(`/admin/employees/${data.id}/disable`, { isDisabled: data.isDisabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    },
  });

  // Reset Password Mutation
  const resetPwdMutation = useMutation({
    mutationFn: (data: { id: string; password: any }) =>
      api.put(`/admin/employees/${data.id}/reset-password`, { password: data.password }),
    onSuccess: () => {
      setPwdModalOpen(false);
      setNewPassword('');
      alert('Password reset successfully.');
    },
  });

  const openModal = (emp: Employee | null = null) => {
    setSelectedEmp(emp);
    if (emp) {
      setFullName(emp.fullName);
      setEmail(emp.email);
      setSelectedPermissions(emp.permissions);
    } else {
      setFullName('');
      setEmail('');
      setPassword('');
      setSelectedPermissions([]);
    }
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setSelectedEmp(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEmp) {
      updateEmpMutation.mutate({
        id: selectedEmp.id,
        data: {
          fullName,
          permissionIds: selectedPermissions,
        },
      });
    } else {
      createEmpMutation.mutate({
        email,
        password,
        fullName,
      });
    }
  };

  const handleTogglePermission = (permId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permId) ? prev.filter((id) => id !== permId) : [...prev, permId]
    );
  };

  const handleResetToDefault = () => {
    if (selectedEmp && window.confirm(`Are you sure you want to reset permissions for ${selectedEmp.fullName} to Role Default?`)) {
      updateEmpMutation.mutate({
        id: selectedEmp.id,
        data: {
          resetToDefault: true,
        },
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-slate-400">Add staff accounts and set role capabilities overrides</p>
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/10 text-sm transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Create Employee
        </button>
      </div>

      {/* Grid List */}
      {isLoading ? (
        <div className="text-center py-20 text-slate-500 text-sm">Loading accounts list...</div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
            <table className="w-full min-w-[800px] border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-850 text-slate-300 text-xs uppercase tracking-wider font-semibold">
                  <th className="p-4">Staff Member</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Overridden Permissions Count</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-sm text-slate-205">
                {employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="p-4">
                      <p className="font-semibold text-white">{emp.fullName}</p>
                      <p className="text-xs text-slate-450">{emp.email}</p>
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                        emp.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-350'
                      }`}>
                        {emp.role}
                      </span>
                    </td>
                    <td className="p-4">
                      <button
                        onClick={() => toggleDisableMutation.mutate({ id: emp.id, isDisabled: !emp.isDisabled })}
                        disabled={emp.role === 'ADMIN'}
                        className={`px-2 py-0.5 rounded text-xs font-semibold cursor-pointer disabled:cursor-not-allowed ${
                          emp.isDisabled
                            ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                        }`}
                      >
                        {emp.isDisabled ? 'Disabled' : 'Active'}
                      </button>
                    </td>
                    <td className="p-4 font-mono text-slate-350">
                      {emp.role === 'ADMIN'
                        ? 'All (Super)'
                        : emp.hasCustomPermissions
                        ? `${emp.permissions.length} Custom`
                        : 'Role Default'}
                    </td>
                    <td className="p-4 text-right space-x-2">
                      {emp.role !== 'ADMIN' && (
                        <>
                          <button
                            onClick={() => openModal(emp)}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer inline-flex"
                            title="Assign Permissions"
                          >
                            <Shield className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setSelectedEmp(emp);
                              setPwdModalOpen(true);
                            }}
                            className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer inline-flex"
                            title="Reset Password"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-4">
            {employees.map((emp) => (
              <div key={emp.id} className="bg-slate-950/30 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-white text-sm">{emp.fullName}</p>
                    <p className="text-xs text-slate-450">{emp.email}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                    emp.role === 'ADMIN' ? 'bg-indigo-500/20 text-indigo-300' : 'bg-slate-800 text-slate-350'
                  }`}>
                    {emp.role}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs border-t border-slate-800/80 pt-2.5">
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Account Status</span>
                    <button
                      onClick={() => toggleDisableMutation.mutate({ id: emp.id, isDisabled: !emp.isDisabled })}
                      disabled={emp.role === 'ADMIN'}
                      className={`mt-1.5 px-2.5 py-0.5 rounded text-xs font-semibold cursor-pointer disabled:cursor-not-allowed ${
                        emp.isDisabled
                          ? 'bg-rose-500/10 text-rose-400 hover:bg-rose-500/20'
                          : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      }`}
                    >
                      {emp.isDisabled ? 'Disabled' : 'Active'}
                    </button>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase text-slate-500 tracking-wider">Custom Override</span>
                    <span className="block mt-2 font-mono text-slate-300">
                      {emp.role === 'ADMIN'
                        ? 'All (Super)'
                        : emp.hasCustomPermissions
                        ? `${emp.permissions.length} Custom`
                        : 'Role Default'}
                    </span>
                  </div>
                </div>

                {emp.role !== 'ADMIN' && (
                  <div className="flex justify-end border-t border-slate-800/80 pt-2.5 space-x-2">
                    <button
                      onClick={() => openModal(emp)}
                      className="flex items-center px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      title="Assign Permissions"
                    >
                      <Shield className="w-3.5 h-3.5 mr-1.5" />
                      Permissions
                    </button>
                    <button
                      onClick={() => {
                        setSelectedEmp(emp);
                        setPwdModalOpen(true);
                      }}
                      className="flex items-center px-3 py-1.5 bg-slate-950 hover:bg-slate-900 border border-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      title="Reset Password"
                    >
                      <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                      Password
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Editor & Permission Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={closeModal} />

          <div className="relative w-full max-w-xl bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl p-6 z-10 my-8 animate-scale-in max-h-[90vh] flex flex-col justify-between">
            <div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
                <h3 className="text-lg font-bold text-white">
                  {selectedEmp ? `Configure overrides for ${selectedEmp.fullName}` : 'Create Employee Profile'}
                </h3>
                <button
                  onClick={closeModal}
                  className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4 overflow-y-auto max-h-[60vh] pr-2">
                {!selectedEmp ? (
                  /* Profile Details for Creation */
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-450 mb-1.5">Employee Name</label>
                      <input
                        type="text"
                        required
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="e.g. John Receptionist"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-450 mb-1.5">Login Email</label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="e.g. staff@eazycheck.com"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-450 mb-1.5">Login Password</label>
                      <input
                        type="password"
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2 px-3.5 text-sm text-white outline-none"
                      />
                    </div>
                  </div>
                ) : (
                  /* Permission overrides list for existing */
                  <div className="space-y-3">
                    <div className={`p-3 text-xs border rounded-xl flex items-start ${
                      selectedEmp.hasCustomPermissions
                        ? 'bg-blue-600/15 border-blue-500/30 text-blue-300'
                        : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                    }`}>
                      <ShieldAlert className="w-4 h-4 mr-2.5 mt-0.5 shrink-0" />
                      <p>
                        {selectedEmp.hasCustomPermissions
                          ? 'This employee has custom permissions applied. Any changes below will update their custom configuration.'
                          : 'This employee is currently using base Role Default permissions. Modifying any selection below will create custom overrides.'}
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Custom Override Permissions Matrix
                      </label>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                        {permissions.map((p) => {
                          const isChecked = selectedPermissions.includes(p.id);
                          return (
                            <label
                              key={p.id}
                              className={`p-3 border rounded-xl flex items-start text-xs cursor-pointer select-none transition-colors ${
                                isChecked
                                  ? 'bg-blue-600/15 border-blue-500/50 text-blue-300'
                                  : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-950/60'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleTogglePermission(p.id)}
                                className="mt-0.5 mr-2.5 accent-blue-500"
                              />
                              <div>
                                <p className="font-semibold text-slate-200 font-mono text-[11px]">{p.name}</p>
                                <p className="text-slate-400 text-[10px] mt-0.5">{p.description}</p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between items-center pt-4 border-t border-slate-800 mt-6">
                  <div>
                    {selectedEmp && selectedEmp.hasCustomPermissions && (
                      <button
                        type="button"
                        onClick={handleResetToDefault}
                        className="px-4 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                      >
                        Reset to Default
                      </button>
                    )}
                  </div>
                  <div className="flex space-x-3">
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
                      {selectedEmp ? 'Apply Permissions' : 'Apply Permissions'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {pwdModalOpen && (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-4 overflow-y-auto">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" onClick={() => setPwdModalOpen(false)} />

          <div className="relative w-full max-w-md bg-slate-900 border border-slate-850 rounded-2xl shadow-2xl p-6 z-10 my-8 animate-scale-in">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4 mb-4">
              <h3 className="text-lg font-bold text-white flex items-center">
                <Lock className="w-5 h-5 text-amber-500 mr-2" />
                Reset Employee Password
              </h3>
              <button
                onClick={() => setPwdModalOpen(false)}
                className="p-1.5 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (selectedEmp) {
                  resetPwdMutation.mutate({ id: selectedEmp.id, password: newPassword });
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-450 mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-blue-500 rounded-xl py-2.5 px-3.5 text-sm text-white outline-none"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setPwdModalOpen(false)}
                  className="px-4 py-2 bg-slate-950 hover:bg-slate-900 text-slate-200 font-semibold rounded-xl text-xs border border-slate-700 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Confirm Reset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
