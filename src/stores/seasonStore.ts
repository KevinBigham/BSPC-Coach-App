import { create } from 'zustand';
import type { SeasonPlan, WeekPlan } from '../types/firestore.types';
import type { Group } from '../config/constants';
import {
  subscribeSeasonPlans,
  subscribeWeekPlans,
  createSeasonPlan,
  updateSeasonPlan,
  deleteSeasonPlan,
  upsertWeekPlan,
} from '../services/seasonPlanning';
import { handleError } from '../utils/errorHandler';

type SeasonPlanWithId = SeasonPlan & { id: string };
type WeekPlanWithId = WeekPlan & { id: string };

interface SeasonState {
  plans: SeasonPlanWithId[];
  activePlan: SeasonPlanWithId | null;
  weeks: WeekPlanWithId[];
  loading: boolean;

  // Subscriptions
  subscribePlans: (coachId: string) => () => void;
  subscribeWeeks: (planId: string) => () => void;

  // Actions
  setActivePlan: (plan: SeasonPlanWithId | null) => void;
  create: (plan: Omit<SeasonPlan, 'createdAt' | 'updatedAt'>) => Promise<string | null>;
  update: (planId: string, updates: Partial<Omit<SeasonPlan, 'createdAt'>>) => Promise<void>;
  remove: (planId: string) => Promise<void>;
  upsertWeek: (planId: string, week: WeekPlan) => Promise<string | null>;
}

export const useSeasonStore = create<SeasonState>((set, get) => ({
  plans: [],
  activePlan: null,
  weeks: [],
  loading: false,

  subscribePlans: (coachId: string) => {
    set({ loading: true });
    return subscribeSeasonPlans(coachId, (plans) => {
      set({ plans, loading: false });
    });
  },

  subscribeWeeks: (planId: string) => {
    return subscribeWeekPlans(planId, (weeks) => {
      set({ weeks });
    });
  },

  setActivePlan: (plan) => {
    set({ activePlan: plan });
  },

  create: async (plan) => {
    try {
      return await createSeasonPlan(plan);
    } catch (error) {
      handleError(error, 'Create season plan');
      return null;
    }
  },

  update: async (planId, updates) => {
    try {
      await updateSeasonPlan(planId, updates);
    } catch (error) {
      handleError(error, 'Update season plan');
    }
  },

  remove: async (planId) => {
    try {
      await deleteSeasonPlan(planId);
      if (get().activePlan?.id === planId) {
        set({ activePlan: null, weeks: [] });
      }
    } catch (error) {
      handleError(error, 'Delete season plan');
    }
  },

  upsertWeek: async (planId, week) => {
    try {
      return await upsertWeekPlan(planId, week);
    } catch (error) {
      handleError(error, 'Update week plan');
      return null;
    }
  },
}));
