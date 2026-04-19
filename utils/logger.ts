const isDev = import.meta.env.DEV;

/**
 * Simple logger that only outputs to console in development mode.
 * Use this for debug information that shouldn't be visible in production.
 */
export const log = (...args: any[]) => {
  if (isDev) {
    console.log(...args);
  }
};
