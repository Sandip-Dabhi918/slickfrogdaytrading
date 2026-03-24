export function calculateDivergence(
  stockCurrent: number,
  stockPrevious: number,
  indexCurrent: number,
  indexPrevious: number
) {

  // percentage change
  const stockChange =
    (stockCurrent - stockPrevious) / stockPrevious;

  const indexChange =
    (indexCurrent - indexPrevious) / indexPrevious;

  const divergence = stockChange - indexChange;

  let signal = "NONE";
  let score = 0;

  // strong divergence threshold
  if (Math.abs(divergence) > 0.01) {

    if (divergence > 0) {
      signal = "BULLISH_DIVERGENCE";
    } else {
      signal = "BEARISH_DIVERGENCE";
    }

    score = 1;
  }

  return {
    stockChange,
    indexChange,
    divergence,
    signal,
    score
  };
}