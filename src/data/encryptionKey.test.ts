import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { getOrCreateDatabaseKey } from '@/data/encryptionKey';

vi.mock('expo-secure-store', () => {
  const store: Record<string, string> = {};
  return {
    AFTER_FIRST_UNLOCK: 'AFTER_FIRST_UNLOCK',
    getItemAsync: vi.fn(async (key: string) => store[key] ?? null),
    setItemAsync: vi.fn(async (key: string, value: string) => {
      store[key] = value;
    }),
    __reset: () => {
      for (const key of Object.keys(store)) {
        delete store[key];
      }
    },
  };
});

vi.mock('expo-crypto', () => {
  let counter = 0;
  return {
    getRandomBytesAsync: vi.fn(async (size: number) => {
      counter += 1;
      const bytes = new Uint8Array(size);
      for (let i = 0; i < size; i += 1) {
        bytes[i] = (counter * 7 + i) % 256;
      }
      return bytes;
    }),
  };
});

describe('getOrCreateDatabaseKey', () => {
  beforeEach(() => {
    (SecureStore as unknown as { __reset: () => void }).__reset();
    vi.mocked(Crypto.getRandomBytesAsync).mockClear();
    vi.mocked(SecureStore.setItemAsync).mockClear();
  });

  it('generates a 256-bit hex key on first call', async () => {
    const key = await getOrCreateDatabaseKey();

    expect(key).toMatch(/^[0-9a-f]+$/);
    expect(key).toHaveLength(64);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledWith(32);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });

  it('returns the same key on subsequent calls without regenerating', async () => {
    const first = await getOrCreateDatabaseKey();
    const second = await getOrCreateDatabaseKey();

    expect(second).toBe(first);
    expect(Crypto.getRandomBytesAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
  });
});
