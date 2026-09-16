import { create } from 'zustand';

export const useToastStore = create((set) => ({
  toast: null,
  show: (toast) => set({ toast: { id: Date.now(), ...toast } }),
  hide: () => set({ toast: null }),
}));

export function showToast(title, message) {
  useToastStore.getState().show({ title, message });
}
