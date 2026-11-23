window.VIZ = {
  title: "Binary search: find 23",
  subtitle: "A sorted array lets you throw away half the candidates on every guess.",
  code: [
    "lo, hi = 0, len(a) - 1",
    "while lo <= hi:",
    "    mid = (lo + hi) // 2",
    "    if a[mid] == target: return mid",
    "    if a[mid] < target: lo = mid + 1",
    "    else:               hi = mid - 1"
  ],
  scene: {
    a: {
      type: "array",
      values: [2, 5, 8, 12, 16, 23, 38, 56, 72, 91],
      pointers: { mid: { side: "above" }, lo: { side: "below" }, hi: { side: "below" } }
    }
  },
  steps: [
    {
      say: "We're looking for 23. The whole array is still in play: lo is the first index, hi the last.",
      line: 0,
      do: [
        { var: "target", value: 23 },
        { pointer: "lo", on: "a", at: 0 },
        { pointer: "hi", on: "a", at: 9 }
      ]
    },
    {
      say: "Guess the middle: mid = (0 + 9) // 2 = 4, which holds 16.",
      line: 2,
      do: [
        { pointer: "mid", on: "a", at: 4 },
        { mark: "a", at: 4, as: "compare" }
      ]
    },
    {
      say: "16 < 23, so 23 can't be at index 4 or anywhere to its left. Drop that half and move lo to 5.",
      line: 4,
      do: [
        { unmark: "a", at: 4 },
        { dim: "a", range: [0, 4] },
        { pointer: "lo", on: "a", at: 5 }
      ]
    },
    {
      say: "New middle: (5 + 9) // 2 = 7, which holds 56.",
      line: 2,
      do: [
        { pointer: "mid", on: "a", at: 7 },
        { mark: "a", at: 7, as: "compare" }
      ]
    },
    {
      say: "56 > 23, so index 7 and everything to its right is out. Move hi to 6.",
      line: 5,
      do: [
        { unmark: "a", at: 7 },
        { dim: "a", range: [7, 9] },
        { pointer: "hi", on: "a", at: 6 }
      ]
    },
    {
      say: "Only two candidates left. mid = (5 + 6) // 2 = 5, which holds 23.",
      line: 2,
      do: [
        { pointer: "mid", on: "a", at: 5 },
        { mark: "a", at: 5, as: "compare" }
      ]
    },
    {
      say: "a[5] == 23: found it after 3 guesses, instead of checking up to 10 cells one by one.",
      line: 3,
      do: [
        { mark: "a", at: 5, as: "found" }
      ]
    }
  ]
};
