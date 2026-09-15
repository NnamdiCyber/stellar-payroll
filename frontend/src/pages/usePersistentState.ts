import { useState, useEffect } from 'react';

export function usePersistentState(
  key: string,
  initialValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(initialValue);

  useEffect(() => {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Private browsing and blocked-storage contexts throw; persistence is
      // best-effort and the in-memory state still works.
    }
  }, [key, value]);

  return [value, setValue];
}
