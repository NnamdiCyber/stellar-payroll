import { useState, useEffect } from 'react';

export function usePersistentState(
  key: string,
  initialValue: string,
): [string, (value: string) => void] {
  const [value, setValue] = useState<string>(initialValue);

  useEffect(() => {
    localStorage.setItem(key, value);
  }, [key, value]);

  return [value, setValue];
}
