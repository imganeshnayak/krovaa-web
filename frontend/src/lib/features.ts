// src/lib/features.ts

/**
 * Feature flag to toggle multi-tenant communities/workspaces.
 * Reads VITE_ENABLE_COMMUNITIES from the environment configuration.
 */
export const ENABLE_COMMUNITIES = import.meta.env.VITE_ENABLE_COMMUNITIES === 'true';
