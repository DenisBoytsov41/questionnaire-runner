const DEFAULT_PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

type PaginationProps = {
  label: string;
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
};

export function Pagination({
  label,
  page,
  pageSize,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
}: PaginationProps) {
  if (totalItems === 0) {
    return null;
  }

  const firstItem = (page - 1) * pageSize + 1;
  const lastItem = Math.min(totalItems, page * pageSize);
  const canGoBack = page > 1;
  const canGoForward = page < totalPages;

  return (
    <nav className="pagination-bar" aria-label={`Страницы: ${label}`}>
      <p className="pagination-summary">
        Показано <strong>{firstItem}-{lastItem}</strong> из <strong>{totalItems}</strong> {label}
      </p>

      <div className="pagination-size-group" aria-label="Количество на странице">
        <span>На странице</span>
        <div className="pagination-size-options">
          {pageSizeOptions.map((option) => (
            <button
              key={option}
              type="button"
              className={`pagination-size-button${option === pageSize ? " active" : ""}`}
              onClick={() => onPageSizeChange(option)}
              aria-pressed={option === pageSize}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="pagination-controls">
        <button type="button" className="pagination-button" disabled={!canGoBack} onClick={() => onPageChange(1)}>
          В начало
        </button>
        <button type="button" className="pagination-button" disabled={!canGoBack} onClick={() => onPageChange(page - 1)}>
          Назад
        </button>
        <span className="pagination-page-indicator">
          {page} из {totalPages}
        </span>
        <button
          type="button"
          className="pagination-button"
          disabled={!canGoForward}
          onClick={() => onPageChange(page + 1)}
        >
          Вперёд
        </button>
      </div>
    </nav>
  );
}
