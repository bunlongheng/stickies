import React from "react";

interface HeaderIconBtnProps {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    onClick?: () => void;
    style?: React.CSSProperties;
    active?: boolean;
    color?: string;
}

// Header action button (search / preview / view-mode / settings). Presentational:
// takes an icon component + handler, no app state.
export function HeaderIconBtn({ icon: Icon, label, onClick, style, active, color }: HeaderIconBtnProps) {
    return (
        <button type="button" onClick={onClick}
            className={`p-3 transition hover:opacity-70 ${color ? "" : (active ? "text-white" : "text-zinc-500 hover:text-white")}`}
            title={label} aria-label={label}
            style={{ ...(color ? { color, opacity: active ? 1 : 0.85 } : {}), ...style }}>
            <Icon className="w-[26px] h-[26px]" />
        </button>
    );
}
