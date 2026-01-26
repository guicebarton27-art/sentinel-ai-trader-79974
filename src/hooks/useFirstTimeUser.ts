import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const WIZARD_COMPLETED_KEY = 'sentinel_wizard_completed';

export const useFirstTimeUser = () => {
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkFirstTimeUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setIsLoading(false);
          return;
        }

        setUserId(user.id);

        // Check localStorage for wizard completion
        const completedKey = `${WIZARD_COMPLETED_KEY}_${user.id}`;
        const hasCompleted = localStorage.getItem(completedKey);
        
        if (hasCompleted) {
          setIsFirstTime(false);
          setIsLoading(false);
          return;
        }

        // Check if user has any bots (indicates they've used the app before)
        const { data: bots, error } = await supabase
          .from('bots')
          .select('id')
          .eq('user_id', user.id)
          .limit(1);

        if (error) {
          console.error('Error checking bots:', error);
          setIsLoading(false);
          return;
        }

        // If no bots exist, this is a first-time user
        setIsFirstTime(!bots || bots.length === 0);
        setIsLoading(false);
      } catch (error) {
        console.error('Error in useFirstTimeUser:', error);
        setIsLoading(false);
      }
    };

    checkFirstTimeUser();
  }, []);

  const markWizardComplete = () => {
    if (userId) {
      const completedKey = `${WIZARD_COMPLETED_KEY}_${userId}`;
      localStorage.setItem(completedKey, 'true');
      setIsFirstTime(false);
    }
  };

  const resetWizard = () => {
    if (userId) {
      const completedKey = `${WIZARD_COMPLETED_KEY}_${userId}`;
      localStorage.removeItem(completedKey);
      setIsFirstTime(true);
    }
  };

  return {
    isFirstTime,
    isLoading,
    markWizardComplete,
    resetWizard,
  };
};
