import {useCallback, useMemo} from 'react';

import {parseSearch} from 'sentry/components/searchSyntax/parser';
import type {Organization} from 'sentry/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';

export enum TabKey {
  CONSOLE = 'console',
  DOM = 'dom',
  ERRORS = 'errors',
  ISSUES = 'issues',
  MEMORY = 'memory',
  NETWORK = 'network',
  TRACE = 'trace',
}

function isReplayTab(tab: string, organization: Organization): tab is TabKey {
  const hasErrorTab = organization.features.includes('session-replay-errors-tab');
  if (tab === TabKey.ERRORS) {
    // If the errors tab feature is enabled, then TabKey.ERRORS is valid.
    return hasErrorTab;
  }
  if (tab === TabKey.ISSUES) {
    // If the errors tab is enabled, then then Issues tab is invalid
    return !hasErrorTab;
  }
  return Object.values<string>(TabKey).includes(tab);
}

function useDefaultTab() {
  const location = useLocation();

  const hasClickSearch = useMemo(() => {
    const parsed = parseSearch(decodeScalar(location.query.query) || '');
    return parsed?.some(
      token => token.type === 'filter' && token.key.text.startsWith('click.')
    );
  }, [location.query.query]);

  if (hasClickSearch) {
    return TabKey.DOM;
  }

  return TabKey.CONSOLE;
}

function useActiveReplayTab() {
  const defaultTab = useDefaultTab();
  const organization = useOrganization();
  const {getParamValue, setParamValue} = useUrlParams('t_main', defaultTab);

  const paramValue = getParamValue()?.toLowerCase() ?? '';

  return {
    getActiveTab: useCallback(
      () => (isReplayTab(paramValue, organization) ? (paramValue as TabKey) : defaultTab),
      [organization, paramValue, defaultTab]
    ),
    setActiveTab: useCallback(
      (value: string) => {
        setParamValue(
          isReplayTab(value.toLowerCase(), organization)
            ? value.toLowerCase()
            : defaultTab
        );
      },
      [organization, setParamValue, defaultTab]
    ),
  };
}

export default useActiveReplayTab;
