// Chronological ordering for Season names. Datable formats (CONTEXT.md "Season"):
//   • new  YY.1 / YY.2   — YY.1 = 20YY SS, YY.2 = 20YY AW           (e.g. 27.1 = 2027 SS)
//   • old  YYSS / YYAW   — e.g. 14AW = 2014 AW, 22SS = 2022 SS
//   • pop  YYPOP         — a 20YY pop-up collection (e.g. 22POP = 2022), placed mid-year
// Season-agnostic / unrecognised names (委託, ALLSS, …) return null — callers must treat null as
// "not comparable", never as earliest/latest.
//
// Key = year*10 + half, half ∈ {SS:1, POP:2, AW:3} (so SS < POP < AW within a year; new .1→1, .2→3
// stays aligned with old AW). Higher = later season. Exact integers don't matter, only their order.
export function seasonSortKey(name: string | null | undefined): number | null {
  if (!name) return null;
  const s = name.trim().toUpperCase();
  let m = s.match(/^(\d{2})\.([12])$/); // new: 27.1 / 26.2
  if (m) return (2000 + Number(m[1])) * 10 + (m[2] === "1" ? 1 : 3);
  m = s.match(/^(\d{2})(SS|POP|AW)$/); // old + pop: 22SS / 22POP / 14AW
  if (m) return (2000 + Number(m[1])) * 10 + (m[2] === "SS" ? 1 : m[2] === "POP" ? 2 : 3);
  return null; // 委託, ALLSS, or anything unrecognised → season-agnostic
}
