export type NodeType = "part" | "paper" | "section" | "paragraph";

export interface RawJsonNode {
	globalId: string;
	htmlText: string | null;
	labels: string[];
	language: string;
	objectID: string;
	paperId: string | null;
	paperSectionId: string | null;
	paperSectionParagraphId: string | null;
	paperTitle: string | null;
	paragraphId: string | null;
	partId: string;
	partTitle?: string;
	partSponsorship?: string;
	sectionId: string | null;
	sectionTitle: string | null;
	sortId: string;
	standardReferenceId: string | null;
	text: string | null;
	type: NodeType;
	typeRank: number;
}

export type RefFormat = "globalId" | "standardReferenceId" | "paperSectionParagraphId" | "unknown";

/**
 * Detect the ID format of a paragraph reference string.
 *
 * - globalId: "1:2.0.1" (partId:paperId.sectionId.paragraphId)
 * - standardReferenceId: "2:0.1" (paperId:sectionId.paragraphId)
 * - paperSectionParagraphId: "2.0.1" (paperId.sectionId.paragraphId)
 */
export function detectRefFormat(ref: string): RefFormat {
	if (/^\d+:\d+\.\d+\.\d+$/.test(ref)) return "globalId";
	if (/^\d+:\d+\.\d+$/.test(ref)) return "standardReferenceId";
	if (/^\d+\.\d+\.\d+$/.test(ref)) return "paperSectionParagraphId";
	return "unknown";
}
