import { formatNumber } from "../../lib/format";

function Pagination({ offset, limit, total, onChange, busy = false }) {
  const start = total === 0 ? 0 : offset + 1;
  const end = Math.min(offset + limit, total);
  const canGoBack = offset > 0;
  const canGoForward = offset + limit < total;

  return (
    <div className="pager">
      <span className="pager-info">
        Showing {formatNumber(start)}–{formatNumber(end)} of {formatNumber(total)}
      </span>

      <div className="pager-buttons">
        <button
          type="button"
          className="button ghost"
          disabled={!canGoBack || busy}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </button>

        <button
          type="button"
          className="button ghost"
          disabled={!canGoForward || busy}
          onClick={() => onChange(offset + limit)}
        >
          Next
        </button>
      </div>
    </div>
  );
}

export default Pagination;
