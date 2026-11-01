function Button({ onClick, disabled, variant = "default", children }) {
  const variants = {
    default: "bg-slate-800 hover:bg-slate-700 active:bg-slate-600 text-slate-100",
    primary: "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 text-white",
    warning: "bg-amber-600 hover:bg-amber-500 active:bg-amber-400 text-white",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`min-h-14 rounded-xl px-4 py-3 text-base font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-0 sm:px-6 sm:py-3 sm:text-base ${variants[variant]}`}
    >
      {children}
    </button>
  );
}

// 2x2 grid of large, thumb-sized buttons on phones (no horizontal scroll,
// nothing smaller than a comfortable tap target); collapses to a single
// centered row once there's enough width for it.
export function ControlPanel({ status, onStart, onPause, onReset, onSkipLevel, onPreviousLevel }) {
  const isRunning = status === "running";

  return (
    <div className="grid grid-cols-2 gap-3 border-t border-slate-800 bg-slate-900 p-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center sm:gap-3 sm:p-5">
      <Button onClick={onPreviousLevel}>◀ Previous</Button>

      {isRunning ? (
        <Button onClick={onPause} variant="warning">
          Pause
        </Button>
      ) : (
        <Button onClick={onStart} variant="primary">
          Start
        </Button>
      )}

      <Button onClick={onReset}>Reset</Button>

      <Button onClick={onSkipLevel}>Skip ▶</Button>
    </div>
  );
}
