import { create } from 'zustand';

// App-shell spec §8. Ids are Date.now(), so two toasts added in the same
// millisecond share one and close together (⚠S5).

export const ToastTone = Object.freeze({
  success: 'success',
  error: 'error',
  info: 'info',
  warning: 'warning',
});

export const useToastStore = create((set) => ({
  toasts: [],
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));

export function addToast(tone = ToastTone.info, title = '', message = '', duration = 5000) {
  const id = Date.now();
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { id, tone, title, message }] }));
  if (duration > 0) {
    setTimeout(() => useToastStore.getState().removeToast(id), duration);
  }
  return id;
}

export function removeToast(id) {
  useToastStore.getState().removeToast(id);
}

// The profile password change toast (app-shell spec §8 callers).
export function showToast(title, message) {
  return addToast(ToastTone.success, title, message);
}
