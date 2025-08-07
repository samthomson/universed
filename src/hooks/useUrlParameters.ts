import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

export interface UrlParameters {
  tab: string | null;
  highlight: string | null;
}

/**
 * Hook to handle URL parameters like tab and highlight
 */
export function useUrlParameters() {
  const location = useLocation();
  const [parameters, setParameters] = useState<UrlParameters>({
    tab: null,
    highlight: null,
  });

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    
    setParameters({
      tab: searchParams.get('tab'),
      highlight: searchParams.get('highlight'),
    });
  }, [location.search]);

  return parameters;
}