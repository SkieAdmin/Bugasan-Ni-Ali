import { useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { useApp } from '../context/AppContext';

// Loads one API resource for a screen (reports, stock history), e.g. useApiData('/reports/sales?days=30').
// It reloads when the path changes and whenever the app's data changes (refresh or an action).
// While a new path loads, `data` is null so old numbers are never shown under a new label.
export function useApiData(path) {
  const { dataVersion } = useApp();
  const [result, setResult] = useState({ path: null, data: null, error: null });
  const latest = useRef(0);

  useEffect(() => {
    const requestId = latest.current + 1;
    latest.current = requestId;
    api.get(path).then(
      (data) => {
        if (requestId === latest.current) setResult({ path, data, error: null });
      },
      (err) => {
        if (requestId === latest.current) setResult((r) => ({ ...r, error: err.message }));
      }
    );
  }, [path, dataVersion]);

  const data = result.path === path ? result.data : null;
  const error = data ? null : result.error;
  return { data, error, loading: !data && !error };
}
