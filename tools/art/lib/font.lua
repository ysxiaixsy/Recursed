-- A small bitmap font, 5 pixels tall, drawn by the scripts themselves so
-- that no font file is needed. Capital letters, digits and a few signs.

local F = {}

local G = {
  A = { ".#.", "#.#", "###", "#.#", "#.#" },
  B = { "##.", "#.#", "##.", "#.#", "##." },
  C = { ".##", "#..", "#..", "#..", ".##" },
  D = { "##.", "#.#", "#.#", "#.#", "##." },
  E = { "###", "#..", "##.", "#..", "###" },
  F = { "###", "#..", "##.", "#..", "#.." },
  G = { ".##", "#..", "#.#", "#.#", ".##" },
  H = { "#.#", "#.#", "###", "#.#", "#.#" },
  I = { "###", ".#.", ".#.", ".#.", "###" },
  J = { "..#", "..#", "..#", "#.#", ".#." },
  K = { "#.#", "#.#", "##.", "#.#", "#.#" },
  L = { "#..", "#..", "#..", "#..", "###" },
  M = { "#...#", "##.##", "#.#.#", "#...#", "#...#" },
  N = { "#..#", "##.#", "#.##", "#..#", "#..#" },
  O = { "###", "#.#", "#.#", "#.#", "###" },
  P = { "##.", "#.#", "##.", "#..", "#.." },
  Q = { "###", "#.#", "#.#", "###", "..#" },
  R = { "##.", "#.#", "##.", "#.#", "#.#" },
  S = { ".##", "#..", ".#.", "..#", "##." },
  T = { "###", ".#.", ".#.", ".#.", ".#." },
  U = { "#.#", "#.#", "#.#", "#.#", "###" },
  V = { "#.#", "#.#", "#.#", "#.#", ".#." },
  W = { "#...#", "#...#", "#.#.#", "#.#.#", ".#.#." },
  X = { "#.#", "#.#", ".#.", "#.#", "#.#" },
  Y = { "#.#", "#.#", ".#.", ".#.", ".#." },
  Z = { "###", "..#", ".#.", "#..", "###" },
  ["0"] = { ".#.", "#.#", "#.#", "#.#", ".#." },
  ["1"] = { ".#.", "##.", ".#.", ".#.", "###" },
  ["2"] = { "##.", "..#", ".#.", "#..", "###" },
  ["3"] = { "##.", "..#", ".#.", "..#", "##." },
  ["4"] = { "#.#", "#.#", "###", "..#", "..#" },
  ["5"] = { "###", "#..", "##.", "..#", "##." },
  ["6"] = { ".##", "#..", "###", "#.#", "###" },
  ["7"] = { "###", "..#", ".#.", ".#.", ".#." },
  ["8"] = { "###", "#.#", "###", "#.#", "###" },
  ["9"] = { "###", "#.#", "###", "..#", "##." },
  ["/"] = { "..#", "..#", ".#.", "#..", "#.." },
  [":"] = { ".", "#", ".", "#", "." },
  ["."] = { ".", ".", ".", ".", "#" },
  [","] = { "..", "..", "..", ".#", "#." },
  ["-"] = { "...", "...", "###", "...", "..." },
  ["+"] = { "...", ".#.", "###", ".#.", "..." },
  ["%"] = { "#.#", "..#", ".#.", "#..", "#.#" },
  ["!"] = { "#", "#", "#", ".", "#" },
  ["x"] = { "...", "#.#", ".#.", "#.#", "..." }, -- multiplication sign
  [">"] = { "#..", ".#.", "..#", ".#.", "#.." },
  [" "] = { "..", "..", "..", "..", ".." },
}

F.height = 5

function F.width(text)
  local w = 0
  for i = 1, #text do
    local g = G[text:sub(i, i)]
    if not g then error("font: no glyph for '" .. text:sub(i, i) .. "'") end
    w = w + #g[1] + 1
  end
  return w > 0 and w - 1 or 0
end

-- Draw text with its top-left corner at x, y. If `shadow` is given, a
-- shadow in that colour is drawn one pixel down and right first.
-- Returns the x position after the text.
function F.draw(c, x, y, text, color, shadow)
  local function pass(ox, oy, col)
    local px = x
    for i = 1, #text do
      local g = G[text:sub(i, i)]
      if not g then error("font: no glyph for '" .. text:sub(i, i) .. "'") end
      for j = 1, 5 do
        local row = g[j]
        for k = 1, #row do
          if row:sub(k, k) == "#" then c:set(px + k - 1 + ox, y + j - 1 + oy, col) end
        end
      end
      px = px + #g[1] + 1
    end
    return px
  end
  if shadow then pass(1, 1, shadow) end
  return pass(0, 0, color)
end

-- Draw text centred on cx, or right-aligned to rx.
function F.centre(c, cx, y, text, color, shadow)
  return F.draw(c, cx - F.width(text) // 2, y, text, color, shadow)
end

function F.right(c, rx, y, text, color, shadow)
  return F.draw(c, rx - F.width(text) + 1, y, text, color, shadow)
end

return F
