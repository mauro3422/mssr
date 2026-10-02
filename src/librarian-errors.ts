/** Internal typed error used to distinguish a valid, exact range that exceeds the fetch return cap. */
export class MssrLibrarianRangeSizeLimitError extends Error {
  readonly code = "MSSR_LIBRARIAN_RANGE_SIZE_LIMIT";

  constructor() {
    super("Exact evidence range exceeds fetch size limit.");
    this.name = "MssrLibrarianRangeSizeLimitError";
  }
}
