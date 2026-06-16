/**
 * pct  — 0-100 for a determinate bar, null for an indeterminate sliding animation
 * label — text shown to the left of the bar
 */
export default function ProgressBar({ pct, label }) {
  const indeterminate = pct === null;
  return (
    <div className="progress-wrap">
      <span className="progress-label">{label}</span>
      <div className="progress-track">
        <div
          className={`progress-fill${indeterminate ? ' indeterminate' : ''}`}
          style={indeterminate ? undefined : { width: `${pct}%` }}
        />
      </div>
      {!indeterminate && <span className="progress-pct">{pct}%</span>}
    </div>
  );
}
