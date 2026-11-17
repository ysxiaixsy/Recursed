-- Asset 3: Battle background, 270 x 480. Floor 1 dungeon hall.
-- The back wall with an archway and two torches is at the top. Enemies
-- stand on the floor in the upper half, the party in the lower half; both
-- zones are plain lit floor so that sprites stay readable.

local core = dofile("lib/core.lua")
local C, S = core.C, core.S
local hash, bayer = core.hash, core.bayer
local floor, sqrt, abs, max, min = math.floor, math.sqrt, math.abs, math.max, math.min

local W, H = 270, 480
local c = core.canvas(W, H)
local function put(x, y, col)
  if x >= 0 and y >= 0 and x < W and y < H then c.col[y * W + x] = col end
end

local WALL_BASE = 128           -- first floor row
local TORCH = { { 68, 66 }, { 202, 66 } }

---------------------------------------------------------------------------
-- Back wall: stone blocks, lit by the two torches
---------------------------------------------------------------------------

-- Tone sets {highlight, base, joint}, from darkest zone to brightest.
local ZONES = {
  { C.navy, C.ink, C.ink },         -- ceiling darkness
  { C.dslate, C.navy, C.ink },      -- ambient
  { C.slate, C.dslate, C.navy },    -- lit, cool
  { C.brown, C.umber, C.ink },      -- torch light, outer
  { C.tan, C.brown, C.umber },      -- torch light, inner
}

local function torchDist(x, y)
  local d = 1e9
  for _, t in ipairs(TORCH) do
    local dx, dy = x - t[1], (y - t[2]) * 1.15
    d = min(d, sqrt(dx * dx + dy * dy))
  end
  return d
end

-- Zone for a wall pixel, with a little ordered dither at zone borders.
local function wallZone(x, y)
  local d = torchDist(x, y)
  local b = bayer(x, y) - 0.5
  if d + b * 5 < 9 then return 5 end
  if d + b * 8 < 21 then return 4 end
  if d + b * 10 < 46 then return 3 end
  if y + b * 14 < 30 then return 1 end
  return 2
end

local BH, BW = 13, 27
for y = 0, WALL_BASE - 1 do
  local k = (WALL_BASE - 1 - y) // BH
  local ly = (WALL_BASE - 1 - y) % BH        -- 0 = bottom row of the block
  local off = (k % 2) * 13 + 5
  for x = 0, W - 1 do
    local bx = (x + off) // BW
    local lx = (x + off) % BW                -- 0 = left column
    local z = ZONES[wallZone(x, y)]
    local h = hash(bx, k, 11)
    local col = z[2]
    if ly == 0 or lx == BW - 1 then
      col = z[3]                             -- joint: bottom and right
    elseif (ly == BH - 1 or lx == 0) and h > 0.25 then
      col = z[1]                             -- lit edge: top and left
    else
      local n = hash(x, y, 3)
      if n < 0.035 then col = z[3] elseif n > 0.975 then col = z[1] end
      if h < 0.16 and bayer(x + bx, y + k) < 0.5 then col = z[3] end -- darker block
    end
    put(x, y, col)
  end
end

-- cracks in the wall
local function crack(x, y, steps, seed, col)
  for i = 1, steps do
    put(x, y, col)
    local r = hash(i, seed, 5)
    if r < 0.45 then y = y + 1 elseif r < 0.75 then x = x + 1; y = y + 1 else x = x - 1 end
  end
end
crack(38, 40, 11, 1, C.ink)
crack(226, 92, 9, 2, C.ink)
crack(176, 36, 8, 3, C.ink)
crack(92, 100, 7, 4, C.ink)

---------------------------------------------------------------------------
-- Archway in the middle of the wall
---------------------------------------------------------------------------

local AX, AY, AR, RING = 135, 80, 27, 7
for y = AY - AR - RING - 1, WALL_BASE - 1 do
  for x = AX - AR - RING - 1, AX + AR + RING do
    local dx, dy = x + 0.5 - AX, y + 0.5 - AY
    local d                                   -- distance from the arch centre line
    if dy < 0 then d = sqrt(dx * dx + dy * dy) else d = abs(dx) end
    if d < AR then
      put(x, y, C.ink)                        -- the dark opening
    elseif d < AR + RING then
      -- arch stones: joints by angle on the curve, by height on the sides
      local joint
      if dy < 0 then
        local a = math.atan(-dy, dx) / math.pi * 180
        joint = (a % 22.5) < (60 / d)
      else
        joint = (y % 16) == 15
      end
      local rim = d - AR
      local col = C.dslate
      if joint then
        col = C.navy
      elseif rim > RING - 1.3 and (dx < 0 or dy < -AR * 0.5) then
        col = C.slate                         -- outer edge that faces the light
      elseif rim < 1.2 then
        col = C.navy                          -- inner edge in shadow
      elseif hash(x, y, 9) < 0.05 then
        col = C.navy
      end
      if dx > AR * 0.6 and rim < RING - 1.3 and bayer(x, y) < 0.45 then col = C.navy end
      put(x, y, col)
    end
  end
end
-- keystone with a spiral rune
for y = AY - AR - RING - 3, AY - AR + 2 do
  for x = AX - 5, AX + 4 do
    local col = C.dslate
    if x == AX - 5 or y == AY - AR - RING - 3 then col = C.slate end
    if x == AX + 4 or y == AY - AR + 2 then col = C.navy end
    put(x, y, col)
  end
end
c:stamp(AX - 3, AY - AR - RING, {
  "bbbbb ",
  "b    b",
  "b bb b",
  "b b  b",
  "b bbbb",
}, { b = C.blue })
put(AX - 1, AY - AR - RING + 2, C.cyan)
-- steps going up into the dark
for i = 0, 3 do
  local y = WALL_BASE - 2 - i * 5
  local x0, x1 = AX - AR + 2 + i * 3, AX + AR - 3 - i * 3
  for x = x0, x1 do
    put(x, y, i < 2 and C.dslate or C.navy)
    if i < 3 then put(x, y + 1, C.navy) end
  end
end

-- cobwebs in the top corners of the opening (the enemy is a spider)
local function web(hx, hy, ends, col)
  local function thread(x0, y0, x1, y1)
    local n = math.max(abs(x1 - x0), abs(y1 - y0))
    for i = 0, n do
      local x, y = floor(x0 + (x1 - x0) * i / n + 0.5), floor(y0 + (y1 - y0) * i / n + 0.5)
      if c:get(x, y) == C.ink then put(x, y, col) end
    end
  end
  for _, e in ipairs(ends) do thread(hx, hy, e[1], e[2]) end
  for _, t in ipairs({ 0.4, 0.7, 1.0 }) do
    for i = 1, #ends - 1 do
      local a, b2 = ends[i], ends[i + 1]
      thread(hx + (a[1] - hx) * t, hy + (a[2] - hy) * t, hx + (b2[1] - hx) * t, hy + (b2[2] - hy) * t)
    end
  end
end
web(115, 60, { { 134, 54 }, { 131, 66 }, { 124, 76 }, { 109, 84 } }, C.dslate)
web(155, 60, { { 140, 54 }, { 144, 64 }, { 150, 71 }, { 161, 76 } }, C.navy)

---------------------------------------------------------------------------
-- Tattered banners on the wall, beside the pillars
---------------------------------------------------------------------------

local function banner(x0)
  local BWD, top, len = 15, 38, 50
  for i = 0, BWD - 1 do
    -- ragged lower edge
    local cut = len - floor(hash(i // 2, x0, 51) * 9) - ((i % 4 == 1) and 3 or 0)
    for j = 0, cut do
      local col = C.blood
      local fold = (i + floor(j / 9)) % 5
      if fold == 0 then col = C.red elseif fold >= 3 then col = C.umber end
      if i == 0 then col = C.red elseif i == BWD - 1 then col = C.umber end
      if j > cut - 2 and hash(i, j, 52) < 0.5 then col = C.umber end
      put(x0 + i, top + j, col)
    end
  end
  -- rod and trim
  c:rect(x0 - 2, top - 2, BWD + 4, 2, C.ink)
  c:hline(x0 - 1, top - 2, BWD + 1, C.slate)
  c:hline(x0, top + 2, BWD, C.clay)
  c:hline(x0, top + 3, BWD, C.rust)
  -- emblem: a spiral
  c:stamp(x0 + 4, top + 12, {
    "ggggggg",
    "g     g",
    "g ggg g",
    "g g g g",
    "g g   g",
    "g ggggg",
  }, { g = C.clay })
  -- shadow on the wall, down and to the right
  for j = 2, len - 8 do
    local x, y = x0 + BWD, top + j
    if c:get(x, y) ~= C.ink then put(x, y, C.ink) end
  end
end
banner(30)
banner(225)

---------------------------------------------------------------------------
-- Torches
---------------------------------------------------------------------------

for _, t in ipairs(TORCH) do
  local x, y = t[1], t[2]
  -- iron bracket
  c:rect(x - 1, y + 9, 2, 12, C.ink)
  c:rect(x - 4, y + 6, 8, 3, C.ink)
  c:hline(x - 3, y + 6, 6, C.slate)
  c:hline(x - 3, y + 7, 3, C.dslate)
  c:set(x - 1, y + 20, C.dslate)
  -- flame
  c:stamp(x - 4, y - 5, {
    "   g    ",
    "   gy   ",
    "  gyy   ",
    "  oywy  ",
    " ogywyo ",
    " oywwyo ",
    " ogywgo ",
    "  ogyg  ",
    "  roor  ",
    "   rr   ",
    "        ",
  }, { w = C.white, y = C.yellow, g = C.gold, o = C.orange, r = C.rust })
  -- sparks
  put(x + 2, y - 8, C.gold); put(x - 3, y - 10, C.orange); put(x + 1, y - 13, C.rust)
end

---------------------------------------------------------------------------
-- Floor: flagstones in perspective, with two pools of light
---------------------------------------------------------------------------

local YV = -40                  -- vanishing line of the floor
local DZ, TW = 0.22, 100        -- tile depth step, tile width at the bottom

-- Light level of the floor, 0 (black) .. 2 (lit). One lit area that
-- covers both the enemy zone and the party zone, dark toward the edges.
local function floorLight(x, y)
  local ex, ey = (x - 135) / 126, (y - 262) / 158
  local b = 1 - (ex * ex * ex * ex + ey * ey * ey * ey)
  local t = 1.45 + b * 1.6
  local near = (y - WALL_BASE) / 10          -- contact shadow under the wall
  if near < 1 then t = t - (1 - near) * 0.9 end
  if t > 2 then t = 2 elseif t < 0 then t = 0 end
  return t, b
end

local TONE = { [0] = C.ink, C.navy, C.dslate, C.slate }

for y = WALL_BASE, H - 1 do
  local zz = (H - YV) / (y + 0.5 - YV)
  local dvdy = ((H - YV) / ((y + 0.5 - YV) ^ 2)) / DZ
  local v = (zz - 1) / DZ
  local row = floor(v)
  local fv = v - row
  local dTop, dBot = (1 - fv) / dvdy, fv / dvdy
  local dudx = zz / TW
  for x = 0, W - 1 do
    local u = (x + 0.5 - 135) * dudx + (row % 2) * 0.5 + 100
    local ti = floor(u)
    local fu = u - ti
    local dLeft, dRight = fu / dudx, (1 - fu) / dudx
    local t, b = floorLight(x, y)
    local lvl = floor(t + bayer(x, y) * 0.999)
    if lvl > 2 then lvl = 2 end
    local h = hash(ti, row, 21)
    local col
    if dBot < 1 or dRight < 1 then
      col = TONE[max(lvl - 1, 0)]                       -- joint
    elseif lvl == 2 and h > 0.45 and (dTop < 1 or dLeft < 1) then
      col = TONE[3]                                     -- lit edge
    else
      col = TONE[lvl]
      if b < 0.2 and h < 0.15 and lvl > 0 and bayer(x + ti, y + row) < 0.5 then
        col = TONE[lvl - 1]                             -- worn tile, away from the light
      elseif b < 0.6 then
        local n = hash(x, y, 17)
        if n < 0.02 and lvl > 0 then col = TONE[lvl - 1] end
      end
    end
    put(x, y, col)
  end
end
-- junction of wall and floor
c:hline(0, WALL_BASE, W, C.ink)

---------------------------------------------------------------------------
-- Pillars at the left and right edges
---------------------------------------------------------------------------

local function pillar(x0)
  local PW = 20
  local profile = {} -- shade by column: light from the left
  for i = 0, PW - 1 do
    local s
    if i == 0 or i == PW - 1 then s = C.ink
    elseif i <= 2 then s = C.dslate
    elseif i <= 5 then s = C.slate
    elseif i <= 10 then s = C.dslate
    else s = C.navy end
    profile[i] = s
  end
  for y = 0, 141 do
    for i = 0, PW - 1 do
      local col = profile[i]
      if i > 0 and i < PW - 1 then
        if i == 10 or i == 11 then col = bayer(i, y) < 0.5 and C.dslate or C.navy end
        if i >= 16 and bayer(i, y) < 0.5 then col = C.ink end
        if y % 36 == 20 then col = C.ink end                       -- drum joint
        if y % 36 == 21 and i <= 10 then col = C.slate end
        if y < 30 and col ~= C.ink and bayer(i, y) < (30 - y) / 30 then col = C.navy end
        if hash(i + x0, y, 31) < 0.03 and col ~= C.ink then col = C.navy end
      end
      put(x0 + i, y, col)
    end
  end
  -- base
  c:rect(x0 - 2, 142, PW + 4, 4, C.ink)
  c:hline(x0 - 1, 142, PW + 2, C.slate)
  c:hline(x0 - 1, 143, PW + 2, C.dslate)
  c:hline(x0 - 1, 144, 12, C.dslate); c:hline(x0 + 11, 144, PW - 10, C.navy)
  c:rect(x0 - 3, 146, PW + 6, 7, C.ink)
  c:hline(x0 - 2, 146, PW + 4, C.slate)
  c:rect(x0 - 2, 147, 13, 5, C.dslate); c:rect(x0 + 11, 147, PW - 9, 5, C.navy)
end
pillar(2)
pillar(248)

---------------------------------------------------------------------------
-- Small details, kept to the edges
---------------------------------------------------------------------------

-- moss at the foot of the wall
for x = 24, 246 do
  local h = hash(x, 0, 41)
  if h < 0.22 and abs(x - AX) > AR then
    put(x, WALL_BASE - 1, C.teal)
    if h < 0.1 then put(x, WALL_BASE - 2, C.forest) end
    if h < 0.04 then put(x, WALL_BASE - 3, C.teal) end
  end
end

-- a skull and bones, left edge
c:stamp(8, 224, {
  "  kkkkkk  ",
  " kggggssk ",
  "kgggggsssk",
  "kgkkgskksk",
  "kgkkgskksk",
  "kgggkkssdk",
  " kggssssk ",
  " kgkgkskk ",
  "  kkkkkk  ",
}, { k = C.ink, g = C.grey, s = C.slate, d = C.dslate })
c:line(22, 236, 31, 239, C.slate); c:line(22, 237, 31, 240, C.ink)
put(21, 235, C.grey); put(32, 240, C.grey)

-- rubble, right edge
c:stamp(246, 250, {
  "   kkk    ",
  "  kssdk kk",
  " ksdddkksk",
  " kdddnkddk",
  "  kkkk kk ",
}, { k = C.ink, s = C.slate, d = C.dslate, n = C.navy })
c:stamp(252, 318, {
  " kk  ",
  "ksdk ",
  "kdnk ",
  " kk  ",
}, { k = C.ink, s = C.slate, d = C.dslate, n = C.navy })

-- cracks in the floor, away from where sprites stand
crack(30, 262, 10, 6, C.ink)
crack(238, 196, 9, 7, C.ink)
crack(18, 332, 12, 8, C.ink)

core.export("background", { { name = "background", canvas = c } }, { previewScale = 2 })
