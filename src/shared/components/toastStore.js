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

// `id` stays Date.now(): ⚠S5 (same-millisecond toasts share an id and close
// together) is reproduced exactly. `key` is unique per toast, for presenting
// it once across hosts (review LOW: by id, the second of two same-millisecond
// toasts was treated as already shown).
let nextToastKey = 0;

export function addToast(tone = ToastTone.info, title = '', message = '', duration = 5000) {
  const id = Date.now();
  nextToastKey += 1;
  const key = nextToastKey;
  useToastStore.setState((state) => ({ toasts: [...state.toasts, { id, key, tone, title, message }] }));
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

// QA BUG-N4: <Modal> draws in its own native window, above the app-level
// ToastHost. Each open AppModal registers here; the TOPMOST one hosts the
// toast stack inside its window and the app-level host steps aside.
export const useToastHostStore = create((set) => ({
  modalHosts: [],
  pushModalHost: (id) => set((state) => ({ modalHosts: [...state.modalHosts.filter((host) => host !== id), id] })),
  popModalHost: (id) => set((state) => ({ modalHosts: state.modalHosts.filter((host) => host !== id) })),
}));

// Review LOW (BUG-N4): a toast can MOVE between hosts (a sheet closes while it
// shows). Each toast (by its unique `key`) is presented once: the next host
// shows it without replaying the entrance or announcing it again.
const presentedToastIds = new Set();
export const wasToastPresented = (id) => presentedToastIds.has(id);
export const markToastPresented = (id) => {
  presentedToastIds.add(id);
};
