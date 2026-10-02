type SourceCluster = { text: string; start: number; end: number };

function sourceClusters(text: string): SourceCluster[] {
  const clusters: SourceCluster[] = [];
  let offset = 0;
  for (const point of text) {
    const end = offset + point.length;
    if (/^\p{M}$/u.test(point) && clusters.length > 0) {
      clusters[clusters.length - 1].text += point;
      clusters[clusters.length - 1].end = end;
    } else {
      clusters.push({ text: point, start: offset, end });
    }
    offset = end;
  }
  return clusters;
}

function foldCluster(value: string): string {
  const normalized = value.toLowerCase().normalize("NFC");
  return normalized === "ñ" ? normalized : normalized.normalize("NFKD").replace(/\p{M}/gu, "");
}

export function foldMssrLibrarianSearchText(value: string): string {
  return sourceClusters(value).map((cluster) => foldCluster(cluster.text)).join("");
}

export function foldMssrLibrarianSearchTextWithSourceOffsets(text: string): { normalized: string; starts: number[]; ends: number[] } {
  let normalized = "";
  const starts: number[] = [];
  const ends: number[] = [];
  for (const cluster of sourceClusters(text)) {
    const folded = foldCluster(cluster.text);
    normalized += folded;
    for (let index = 0; index < folded.length; index += 1) {
      starts.push(cluster.start);
      ends.push(cluster.end);
    }
  }
  return { normalized, starts, ends };
}
