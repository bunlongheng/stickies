// @vitest-environment jsdom
/**
 * Unit: components/HeaderIconBtn - presentational header action button.
 */
import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "./helpers";
import { HeaderIconBtn } from "@/components/HeaderIconBtn";

const Icon = ({ className }: { className?: string }) => <svg data-testid="icon" className={className} />;

describe("HeaderIconBtn", () => {
    it("renders the icon and exposes the label as title + aria-label", () => {
        const { getByRole, getByTestId } = render(<HeaderIconBtn icon={Icon} label="Search" />);
        const btn = getByRole("button", { name: "Search" });
        expect(btn).toHaveAttribute("title", "Search");
        expect(getByTestId("icon")).toBeInTheDocument();
    });

    it("fires onClick when pressed", () => {
        const onClick = vi.fn();
        const { getByRole } = render(<HeaderIconBtn icon={Icon} label="Settings" onClick={onClick} />);
        fireEvent.click(getByRole("button", { name: "Settings" }));
        expect(onClick).toHaveBeenCalledOnce();
    });

    it("applies the color style branch when a color is given", () => {
        const { getByRole } = render(<HeaderIconBtn icon={Icon} label="View" color="#ff0000" active />);
        expect(getByRole("button", { name: "View" })).toHaveStyle({ color: "#ff0000", opacity: "1" });
    });

    it("uses the active text class when no color and active", () => {
        const { getByRole } = render(<HeaderIconBtn icon={Icon} label="Preview" active />);
        expect(getByRole("button", { name: "Preview" }).className).toContain("text-white");
    });
});
