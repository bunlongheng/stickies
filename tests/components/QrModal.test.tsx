// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "./helpers";
import { QrModal } from "@/components/QrModal";

vi.mock("qrcode.react", () => ({ QRCodeCanvas: () => <canvas data-testid="qr" /> }));

const base = { qrData: "https://x.test/n/1", accentColor: "#5856D6", copied: false, onCopy: () => {}, onClose: () => {} };

describe("QrModal", () => {
    it("shows a link title and the path preview", () => {
        render(<QrModal {...base} qrType="link" />);
        expect(screen.getByText("QR - Link")).toBeInTheDocument();
        expect(screen.getByText("Copy Link")).toBeInTheDocument();
    });

    it("shows the data title and scan hint", () => {
        render(<QrModal {...base} qrType="data" />);
        expect(screen.getByText("QR - Data")).toBeInTheDocument();
        expect(screen.getByText("Scan to copy note content")).toBeInTheDocument();
    });

    it("fires onCopy and onClose", () => {
        const onCopy = vi.fn(), onClose = vi.fn();
        render(<QrModal {...base} qrType="link" onCopy={onCopy} onClose={onClose} />);
        fireEvent.click(screen.getByText("Copy Link"));
        expect(onCopy).toHaveBeenCalledOnce();
        fireEvent.click(screen.getByText("Close"));
        expect(onClose).toHaveBeenCalledOnce();
    });

    it("reflects the copied state", () => {
        render(<QrModal {...base} qrType="link" copied />);
        expect(screen.getByText("Copied")).toBeInTheDocument();
    });
});
