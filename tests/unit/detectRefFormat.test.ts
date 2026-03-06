import { describe, expect, it } from "bun:test";
import { detectRefFormat } from "../../src/types/node.ts";

describe("detectRefFormat", () => {
	it("returns 'globalId' for '1:2.0.1'", () => {
		expect(detectRefFormat("1:2.0.1")).toBe("globalId");
	});

	it("returns 'globalId' for edge case '0:0.0.0'", () => {
		expect(detectRefFormat("0:0.0.0")).toBe("globalId");
	});

	it("returns 'standardReferenceId' for '2:0.1'", () => {
		expect(detectRefFormat("2:0.1")).toBe("standardReferenceId");
	});

	it("returns 'paperSectionParagraphId' for '2.0.1'", () => {
		expect(detectRefFormat("2.0.1")).toBe("paperSectionParagraphId");
	});

	it("returns 'unknown' for 'foobar'", () => {
		expect(detectRefFormat("foobar")).toBe("unknown");
	});

	it("returns 'unknown' for empty string", () => {
		expect(detectRefFormat("")).toBe("unknown");
	});

	it("returns 'unknown' for partial formats", () => {
		expect(detectRefFormat("2:0")).toBe("unknown");
		expect(detectRefFormat("2.0")).toBe("unknown");
		expect(detectRefFormat("2")).toBe("unknown");
	});
});
