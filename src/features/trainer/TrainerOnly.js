import { useEffect } from 'react';

import { useAuthStore } from '../auth/authStore';
import { openShellPath } from '../shell/shellLinks';
import { isTrainerUser } from '../shell/shellRules';

// Web `TrainerRoute`: without the trainer role claim, go to Home.
export default function TrainerOnly({ children }) {
  const isTrainer = useAuthStore((state) => isTrainerUser(state.user));

  useEffect(() => {
    if (!isTrainer) {
      openShellPath('/');
    }
  }, [isTrainer]);

  return isTrainer ? children : null;
}
