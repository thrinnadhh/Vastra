'use client';

import {
  ApiClientError,
  createApiClient,
  type ApiClientLogger,
  type FetchRequestInitLike,
} from '@vastra/api-client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { createAdminOperationsApi } from './admin-operations.api';
import { AdminOperationsView, type AdminOperationsState } from './admin-operations.view';

export interface AdminApiSession {
  readonly apiBaseUrl: string;
  getAccessToken(): Promise<string | null>;
}

interface AdminOperationsScreenProps {
  readonly session: AdminApiSession;
  readonly onSessionExpired: () => void;
}

const browserFetch = (url: string, init: FetchRequestInitLike) => fetch(url, init as RequestInit);

const logger: ApiClientLogger = {
  log(event): void {
    const method = event.phase === 'failure' ? 'error' : 'info';
    console[method](
      JSON.stringify({
        scope: 'admin-api',
        ...event,
      }),
    );
  },
};

function errorState(error: unknown): AdminOperationsState {
  if (error instanceof ApiClientError) {
    if (error.normalized.kind === 'AUTHORIZATION') return { kind: 'ACCESS_DENIED' };
    return { kind: 'ERROR', requestId: error.normalized.requestId };
  }
  return { kind: 'ERROR', requestId: null };
}

function mergeOrders<T extends { readonly id: string }>(
  existing: readonly T[],
  incoming: readonly T[],
): readonly T[] {
  return [...new Map([...existing, ...incoming].map((order) => [order.id, order])).values()];
}

export function AdminOperationsScreen({
  session,
  onSessionExpired,
}: AdminOperationsScreenProps): React.JSX.Element {
  const [state, setState] = useState<AdminOperationsState>({ kind: 'LOADING' });
  const [statusFilter, setStatusFilter] = useState('');
  const [issueFilter, setIssueFilter] = useState('');
  const [reloadVersion, setReloadVersion] = useState(0);
  const activeRequest = useRef(0);
  const api = useMemo(
    () =>
      createAdminOperationsApi(
        createApiClient({
          baseUrl: session.apiBaseUrl,
          fetch: browserFetch,
          accessTokenProvider: session,
          actor: 'admin',
          logger,
        }),
      ),
    [session],
  );

  useEffect(() => {
    const request = ++activeRequest.current;
    void api.load(statusFilter, issueFilter).then(
      (snapshot) => {
        if (activeRequest.current !== request) return;
        setState({ kind: 'READY', ...snapshot, loadingMore: false });
      },
      (error: unknown) => {
        if (activeRequest.current !== request) return;
        if (error instanceof ApiClientError && error.normalized.kind === 'AUTHENTICATION') {
          onSessionExpired();
          return;
        }
        setState(errorState(error));
      },
    );
    return () => {
      activeRequest.current += 1;
    };
  }, [api, issueFilter, onSessionExpired, reloadVersion, statusFilter]);

  const retry = useCallback(() => {
    setState({ kind: 'LOADING' });
    setReloadVersion((value) => value + 1);
  }, []);

  const changeStatusFilter = useCallback((value: string) => {
    setState({ kind: 'LOADING' });
    setStatusFilter(value);
  }, []);

  const changeIssueFilter = useCallback((value: string) => {
    setState({ kind: 'LOADING' });
    setIssueFilter(value);
  }, []);

  const loadMore = useCallback(() => {
    if (state.kind !== 'READY' || state.nextCursor === null || state.loadingMore) return;
    const request = ++activeRequest.current;
    const cursor = state.nextCursor;
    setState({ ...state, loadingMore: true });
    void api.loadMore(statusFilter, issueFilter, cursor).then(
      (page) => {
        if (activeRequest.current !== request) return;
        setState({
          ...state,
          orders: mergeOrders(state.orders, page.orders),
          nextCursor: page.nextCursor,
          loadingMore: false,
        });
      },
      (error: unknown) => {
        if (activeRequest.current !== request) return;
        if (error instanceof ApiClientError && error.normalized.kind === 'AUTHENTICATION') {
          onSessionExpired();
          return;
        }
        setState(errorState(error));
      },
    );
  }, [api, issueFilter, onSessionExpired, state, statusFilter]);

  return (
    <AdminOperationsView
      issueFilter={issueFilter}
      onIssueFilterChange={changeIssueFilter}
      onLoadMore={loadMore}
      onRetry={retry}
      onStatusFilterChange={changeStatusFilter}
      state={state}
      statusFilter={statusFilter}
    />
  );
}
