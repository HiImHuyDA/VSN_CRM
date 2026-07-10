import React, { useState } from 'react';
import api from '../../services/api';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword !== confirmPassword) {
      setError('Mật khẩu mới không khớp.');
      return;
    }
    if (newPassword.length < 6) {
      setError('Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }

    setIsLoading(true);
    try {
      const userStr = localStorage.getItem('csr_user');
      const user = userStr ? JSON.parse(userStr) : null;
      const mnv = user?.mnv || user?.MNV;

      const response = await api.post('/auth/change-password', {
        mnv,
        oldPassword,
        newPassword
      });
      if (response.success) {
        setSuccess('Đổi mật khẩu thành công!');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(response.error || 'Có lỗi xảy ra.');
      }
    } catch (err) {
      setError(err.message || 'Không thể đổi mật khẩu.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
      <div className="bg-surface rounded-2xl w-full max-w-md overflow-hidden shadow-elevation-3">
        <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
          <h2 className="font-headline-sm text-headline-sm font-bold text-on-surface">Thay đổi mật khẩu</h2>
          <button onClick={onClose} className="material-symbols-outlined text-on-surface-variant hover:text-error">
            close
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <div className="p-3 bg-error/10 text-error rounded-lg text-sm">{error}</div>}
          {success && <div className="p-3 bg-primary/10 text-primary rounded-lg text-sm">{success}</div>}
          
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Mật khẩu cũ</label>
            <input 
              type="password" 
              required
              className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Mật khẩu mới</label>
            <input 
              type="password" 
              required
              className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Xác nhận mật khẩu mới</label>
            <input 
              type="password" 
              required
              className="w-full px-3 py-2 border border-outline rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 text-primary hover:bg-primary/10 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button 
              type="submit" 
              disabled={isLoading}
              className="px-4 py-2 bg-primary text-on-primary rounded-lg font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Đang lưu...' : 'Xác nhận'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
