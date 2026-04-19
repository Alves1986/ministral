
import '@testing-library/jest-dom';
// Cleanup after each test case (e.g. clearing jsdom)
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
