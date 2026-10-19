import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';

// A list filter that starts from the ?filter= route param (e.g. when the dashboard
// opens a tab with "pending" already selected) and can then be changed by the user.
export function useParamFilter(fallback = 'all') {
  const { filter: param } = useLocalSearchParams();
  const [choice, setChoice] = useState({ param, value: param || fallback });
  const filter = choice.param === param ? choice.value : param || fallback;
  const setFilter = (value) => setChoice({ param, value });
  return [filter, setFilter];
}
