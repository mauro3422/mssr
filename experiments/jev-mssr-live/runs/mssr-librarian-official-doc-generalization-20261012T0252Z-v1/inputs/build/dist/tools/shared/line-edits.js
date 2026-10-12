import { preferredNewline, splitTextLines } from "./text-files.js";
export function normalizeLineNumber(value, label) {
    if (!Number.isInteger(value) || value < 1)
        throw new Error(`${label} must be a positive integer.`);
    return value;
}
function formatSnippet(lines, startLine, endLine) {
    const start = Math.max(1, startLine);
    const end = Math.min(lines.length, endLine);
    const out = [];
    for (let line = start; line <= end; line += 1) {
        out.push({ line, text: lines[line - 1] ?? "" });
    }
    return out;
}
function normalizeNewContent(content) {
    if (content.length === 0)
        return [];
    return splitTextLines(content);
}
export function applyLineEdit(input) {
    const lines = splitTextLines(input.snapshot.text);
    const hadTrailingNewline = /(?:\r\n|\n)$/.test(input.snapshot.text);
    const newline = preferredNewline(input.snapshot.lineEnding);
    const startLine = normalizeLineNumber(input.startLine, "startLine");
    const mode = input.mode ?? (input.endLine === undefined ? "insert_after" : "replace");
    const previewContext = Math.max(0, Math.min(10, Math.trunc(input.previewContext ?? 2)));
    if (startLine > lines.length + 1) {
        throw new Error(`startLine ${startLine} is outside file range 1-${lines.length}.`);
    }
    let endLine = input.endLine === undefined ? startLine : normalizeLineNumber(input.endLine, "endLine");
    if (endLine < startLine)
        throw new Error("endLine must be greater than or equal to startLine.");
    if (endLine > lines.length)
        endLine = lines.length;
    const contentLines = normalizeNewContent(input.newContent ?? "");
    const beforeContext = formatSnippet(lines, startLine - previewContext, Math.min(lines.length, (input.endLine ?? startLine) + previewContext));
    let updatedLines;
    let affectedRange;
    let removedLines = [];
    if (mode === "insert_before") {
        if ((input.newContent ?? "").length === 0)
            throw new Error("newContent is required for insert_before.");
        const idx = Math.max(0, Math.min(lines.length, startLine - 1));
        updatedLines = [...lines.slice(0, idx), ...contentLines, ...lines.slice(idx)];
        affectedRange = { startLine, endLine: null };
    }
    else if (mode === "insert_after") {
        if ((input.newContent ?? "").length === 0)
            throw new Error("newContent is required for insert_after.");
        const idx = Math.max(0, Math.min(lines.length, startLine));
        updatedLines = [...lines.slice(0, idx), ...contentLines, ...lines.slice(idx)];
        affectedRange = { startLine, endLine: null };
    }
    else if (mode === "delete") {
        removedLines = lines.slice(startLine - 1, endLine);
        updatedLines = [...lines.slice(0, startLine - 1), ...lines.slice(endLine)];
        affectedRange = { startLine, endLine };
    }
    else {
        if ((input.newContent ?? "").length === 0)
            throw new Error("newContent is required for replace. Use mode='delete' to delete lines.");
        removedLines = lines.slice(startLine - 1, endLine);
        updatedLines = [...lines.slice(0, startLine - 1), ...contentLines, ...lines.slice(endLine)];
        affectedRange = { startLine, endLine };
    }
    let updatedText = updatedLines.join(newline);
    if (hadTrailingNewline)
        updatedText += newline;
    const afterContext = formatSnippet(updatedLines, startLine - previewContext, Math.min(updatedLines.length, startLine + contentLines.length + previewContext));
    return {
        updatedText,
        summary: {
            mode,
            affectedRange,
            oldTotalLines: lines.length,
            newTotalLines: updatedLines.length,
            lineDelta: updatedLines.length - lines.length,
            insertedLineCount: mode === "delete" ? 0 : contentLines.length,
            removedLineCount: removedLines.length,
            beforeContext,
            afterContext,
        },
    };
}
