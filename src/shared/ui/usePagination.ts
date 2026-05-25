import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 10;

type PaginationOptions = {
  defaultPageSize?: number;
  resetKey?: string;
};

type PaginationState = {
  page: number;
  pageSize: number;
  resetKey?: string;
};

function clampPage(page: number, totalPages: number) {
  return Math.min(Math.max(page, 1), totalPages);
}

export function usePagination<T>(items: T[], options: PaginationOptions = {}) {
  const [state, setState] = useState<PaginationState>({
    page: 1,
    pageSize: options.defaultPageSize ?? DEFAULT_PAGE_SIZE,
    resetKey: options.resetKey,
  });
  const totalItems = items.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  const page = clampPage(state.resetKey === options.resetKey ? state.page : 1, totalPages);

  const pageItems = useMemo(() => {
    const startIndex = (page - 1) * state.pageSize;

    return items.slice(startIndex, startIndex + state.pageSize);
  }, [items, page, state.pageSize]);

  const setPage = (nextPage: number) => {
    setState((currentState) => ({
      ...currentState,
      page: nextPage,
      resetKey: options.resetKey,
    }));
  };

  const setPageSize = (nextPageSize: number) => {
    setState((currentState) => ({
      ...currentState,
      page: 1,
      pageSize: nextPageSize,
      resetKey: options.resetKey,
    }));
  };

  return {
    page,
    pageItems,
    pageSize: state.pageSize,
    setPage,
    setPageSize,
    totalItems,
    totalPages,
  };
}
