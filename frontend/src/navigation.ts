export type CatalogTab = 'servers' | 'models';
export type ResultsTab = 'dashboard' | 'leaderboard' | 'history';

export function normalizeCatalogTab(value: string | null): CatalogTab {
  return value === 'models' ? 'models' : 'servers';
}

export function normalizeResultsTab(value: string | null): ResultsTab {
  if (value === 'leaderboard' || value === 'history') {
    return value;
  }
  return 'dashboard';
}

export function catalogSearch(tab: CatalogTab, params?: { serverId?: string | null; modelId?: string | null }): string {
  const search = new URLSearchParams({ tab });
  if (params?.serverId) {
    search.set('serverId', params.serverId);
  }
  if (params?.modelId) {
    search.set('modelId', params.modelId);
  }
  return `?${search.toString()}`;
}

export function resultsSearch(tab: ResultsTab): string {
  return `?${new URLSearchParams({ tab }).toString()}`;
}

export function legacyRedirectSearch(target: string, currentSearch = ''): { pathname: string; search: string } {
  const params = new URLSearchParams(currentSearch);
  switch (target) {
    case 'servers':
      params.set('tab', 'servers');
      return { pathname: '/catalog', search: `?${params.toString()}` };
    case 'models':
      params.set('tab', 'models');
      return { pathname: '/catalog', search: `?${params.toString()}` };
    case 'run-single':
      return { pathname: '/run', search: currentSearch };
    case 'compare':
      params.set('legacy', 'compare');
      return { pathname: '/run', search: `?${params.toString()}` };
    case 'dashboard':
      params.set('tab', 'dashboard');
      return { pathname: '/results', search: `?${params.toString()}` };
    case 'leaderboard':
      params.set('tab', 'leaderboard');
      return { pathname: '/results', search: `?${params.toString()}` };
    default:
      return { pathname: '/catalog', search: '?tab=servers' };
  }
}
