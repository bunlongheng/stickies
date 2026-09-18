import { describe, it, expect } from "vitest";
import { insertById } from "@/lib/array";

const ids = (arr: { id: number | string }[]) => arr.map((x) => String(x.id)).join(",");

describe("insertById", () => {
    const list = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];

    it("moves an item before the target", () => {
        expect(ids(insertById(list, "4", "2", "before"))).toBe("1,4,2,3");
    });
    it("moves an item after the target", () => {
        expect(ids(insertById(list, "1", "3", "after"))).toBe("2,3,1,4");
    });
    it("compares ids as strings (numeric and string ids match)", () => {
        const mixed = [{ id: "a" }, { id: 10 }, { id: "b" }];
        expect(ids(insertById(mixed, "b", "a", "before"))).toBe("b,a,10");
    });
    it("returns the original array when either id is missing", () => {
        expect(insertById(list, "99", "2", "before")).toBe(list);
        expect(insertById(list, "1", "99", "after")).toBe(list);
    });
    it("does not mutate the input", () => {
        const snapshot = ids(list);
        insertById(list, "4", "1", "before");
        expect(ids(list)).toBe(snapshot);
    });
});
