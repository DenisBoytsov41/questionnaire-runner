interface BrandHeaderProps {
  subtitle: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function BrandHeader({ subtitle, action }: BrandHeaderProps) {
  return (
    <div className="top-bar">
      <div className="brand-lockup">
        <span className="brand-logo-mark">
          <img src="/ks-logo-full.png" alt="К-Сервис" className="brand-logo" />
        </span>

        <div>
          <strong>К-Сервис</strong>
          <span>{subtitle}</span>
        </div>
      </div>

      {action && (
        <button type="button" className="secondary-button" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
