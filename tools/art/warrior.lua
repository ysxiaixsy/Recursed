-- Asset 1: Warrior (hero), 64 x 64, front view, idle pose.
-- Steel plate armour, red shield, sword held upright.

local core = dofile("lib/core.lua")
local C, R, S, mat = core.C, core.R, core.S, core.mat

local W, H = 64, 64
local CX = 32 -- the figure is symmetric about x = 32
local c = core.canvas(W, H)

-- Form shadow: the side away from the light (right) is darker.
c.gmod = function(x, y)
  local t = (x - 33) / 13
  if t < 0 then t = 0 elseif t > 1 then t = 1 end
  return -1.0 * t
end

local steel   = mat(R.steel, 5, { bevel = 3.2, gain = 1.15 })
local steelDk = mat(R.steel, 4, { bevel = 2.6, gain = 1.15 })
local mail    = mat(R.steel, 3, { bevel = 5, noise = 1.6, hi = 5 })
local leather = mat(R.leather, 3, { bevel = 2.5 })
local cloth   = mat(R.red, 3, { bevel = 4 })
local gold    = mat(R.gold, 5, { bevel = 1.6 })
local blade   = mat(R.steel, 6, { bevel = 1.4, lo = 4 })

-- Tattered cape, behind everything. It stops at the knees so that the
-- legs stay clear in the silhouette. -------------------------------------------
c:newPart()
local cape = S.poly({
  19, 24, 45, 24, 46.5, 40, 46, 50,
  44, 53, 42, 50, 40, 53.5, 37, 50.5, 34.5, 53.5, 32, 50.5, 29.5, 53.5,
  27, 50.5, 24, 53.5, 21.5, 50, 19.5, 52.5, 18, 49, 17.5, 40 })
c:fill(cape, mat(R.red, 2, { bevel = 3, hi = 3 }), {
  mod = function(x, y) return ((math.floor(x / 3) % 2 == 0) and 0.4 or 0) + (y - 40) / 40 end,
})

-- Plume, behind the helmet --------------------------------------------------
c:newPart()
c:fill(S.union(S.ellipse(32.6, 4.8, 3.6, 3.0), S.capsule(34, 5, 42.0, 11.0, 2.9, 1.3)), cloth,
  { base = 4, bevel = 3 })

-- Legs ------------------------------------------------------------------------
for side = 1, 2 do
  local function m(f) return side == 1 and f or S.mirror(f, CX) end
  c:newPart() -- thigh, leather
  c:fill(m(S.capsule(27.6, 42, 27.2, 50, 3.6, 3.2)), leather, { base = 3 })
  c:newPart() -- greave
  c:fill(m(S.capsule(27.0, 52, 26.6, 57.5, 3.2, 2.7)), steel)
  c:newPart() -- boot
  c:fill(m(S.box(25.8, 59.6, 3.9, 2.0, 1.6)), steelDk, { bevel = 2 })
  c:newPart() -- knee cop
  c:fill(m(S.ellipse(27.1, 50.4, 3.3, 2.7)), steel, { bevel = 2.6 })
end

-- Mail skirt and tabard -------------------------------------------------------
c:newPart()
c:fill(S.poly({ 23, 37, 41, 37, 43.0, 44.6, 21.0, 44.6 }, 0.6), mail)
local tabardPart = c:newPart()
local tabard = S.poly({ 28.2, 37, 35.8, 37, 36.3, 45.5, 32, 49.2, 27.7, 45.5 })
c:fill(tabard, cloth, { base = 4, bevel = 5 })
c:fill(S.sub(tabard, S.offset(tabard, -1.2)), gold,
  { clip = S.box(32, 48.8, 8, 4.2), bevel = 1.2, decal = tabardPart })

-- Torso -----------------------------------------------------------------------
c:newPart()
c:fill(S.ellipse(32, 21.5, 5.2, 2.8), steelDk) -- gorget
local chestPart = c:newPart()
local chest = S.union(S.box(32, 28.5, 9.6, 6.6, 4.5), S.poly({ 23.4, 30, 40.6, 30, 38.8, 37.5, 25.2, 37.5 }))
c:fill(chest, steel, { bevel = 5 })
c:newPart() -- belt
c:fill(S.box(32, 38.2, 8.4, 1.5, 0.6), leather, { base = 3, bevel = 1.4 })

-- Sword (behind the sword hand) -----------------------------------------------
c:newPart()
c:fill(S.poly({ 10.3, 36.8, 13.9, 36.8, 12.6, 12.5, 10.9, 8.2, 9.2, 12.5 }), blade)
c:newPart()
c:fill(S.capsule(12.1, 38.0, 12.1, 44.8, 1.2), leather, { base = 3 })      -- grip
c:fill(S.box(12.1, 37.2, 4.7, 1.2, 0.9), gold)                             -- crossguard
c:fill(S.circle(12.1, 46.0, 1.7), gold)                                    -- pommel

-- Sword arm (viewer's left) ---------------------------------------------------
c:newPart()
c:fill(S.capsule(20.0, 27.0, 15.6, 33.0, 3.1, 2.8), mail, { base = 4, hi = 5 })
c:newPart()
c:fill(S.capsule(15.2, 34.0, 12.9, 39.8, 2.9, 2.5), steel)
c:newPart()
c:fill(S.circle(15.4, 33.4, 2.7), steel)                                   -- elbow cop
c:newPart()
c:fill(S.ellipse(12.2, 41.7, 2.9, 2.6), steelDk, { bevel = 2.2 })          -- gauntlet

-- Shield arm (viewer's right), mostly hidden by the shield ---------------------
c:newPart()
c:fill(S.capsule(44.0, 27.0, 47.0, 34.0, 3.1, 2.8), mail, { base = 4, hi = 5 })

-- Pauldrons, with a gold rim on the top plate -----------------------------------
for side = 1, 2 do
  local function m(f) return side == 1 and f or S.mirror(f, CX) end
  c:newPart()
  c:fill(m(S.ellipse(20.6, 26.8, 5.6, 3.9)), steelDk, { bevel = 3 })
  local p = c:newPart()
  local top = m(S.ellipse(21.2, 24.0, 6.0, 4.4))
  c:fill(top, steel, { bevel = 3.6 })
  c:fill(S.sub(top, S.offset(top, -1.1)), gold,
    { clip = m(S.box(21.2, 28, 7, 2.6)), bevel = 1.1, decal = p })
end

-- Shield ----------------------------------------------------------------------
local shield = S.poly({ 40.5, 28, 54.5, 28, 54.5, 38, 52.4, 44, 47.5, 50.2, 42.6, 44, 40.5, 38 }, 0.8)
c:newPart()
c:fill(shield, gold, { bevel = 1.6 })
local field = S.offset(shield, -2.0)
local fieldPart = c:newPart({ sep = false, shadow = false })
c:fill(field, cloth, { base = 4, bevel = 7 })
local cross = S.union(S.box(47.5, 38.5, 1.1, 9, 0), S.box(47.5, 35.6, 5, 1.1, 0))
c:fill(cross, mat(R.bone, 5), { clip = S.offset(field, -1.0), bevel = 7, decal = fieldPart })

-- Helmet ----------------------------------------------------------------------
local helmPart = c:newPart()
local helm = S.union(
  S.ellipse(32, 11.8, 7.7, 7.4),
  S.poly({ 24.5, 12, 39.5, 12, 39.3, 16.5, 36.2, 20.6, 27.8, 20.6, 24.7, 16.5 }, 0.5))
c:fill(helm, steel, { bevel = 6 })
c:newPart({ sep = false, shadow = false }) -- crest ridge
c:fill(S.capsule(32, 5.0, 32, 10.2, 1.1), steel, { base = 6, bevel = 1.2 })

-- Lighting passes ---------------------------------------------------------------
c:castShadows(2, -1)
c:separate(2, 3)

-- Hand-placed details -----------------------------------------------------------
-- visor: a T-shaped opening
c:rect(26, 12, 12, 2, C.ink)
c:rect(31, 14, 2, 6, C.ink)
c:set(26, 12, C.navy); c:set(37, 13, C.navy)
-- brow highlight above the slit, light side only
for x = 26, 30 do c:shade(x, 11, 1) end
-- eyes in the dark
c:set(28, 13, C.slate); c:set(35, 13, C.slate)
-- breathing holes
c:set(29, 16, C.dslate); c:set(29, 18, C.dslate)
c:set(34, 16, C.navy); c:set(34, 18, C.navy)

-- breastplate: centre ridge, chest line and two belly plates
for y = 24, 36 do
  c:shadeOn(chestPart, 31, y, 1)
  c:shadeOn(chestPart, 32, y, -1)
end
for x = 23, 40 do
  local dx = (x - 31.5) / 8.5
  local y = math.floor(29.8 + 1.4 * dx * dx)
  if x ~= 31 and x ~= 32 then
    c:shadeOn(chestPart, x, y, -1)
    if x < 31 then c:shadeOn(chestPart, x, y + 1, 1) end
  end
end
for _, y in ipairs({ 33, 35 }) do
  for x = 24, 39 do
    c:shadeOn(chestPart, x, y, -1)
  end
end
-- rivets
c:set(25, 25, C.white); c:set(38, 25, C.grey)
-- wear: small dents and scratches
c:shadeOn(chestPart, 27, 27, -1); c:shadeOn(chestPart, 28, 26, -1)
c:shadeOn(chestPart, 36, 31, -1); c:shadeOn(chestPart, 37, 32, -1)
c:shadeOn(helmPart, 36, 8, -1); c:shadeOn(helmPart, 37, 9, -1)
c:shadeOn(helmPart, 27, 16, -1); c:shadeOn(helmPart, 28, 7, -1)

-- belt buckle
c:rect(31, 37, 2, 3, C.gold); c:set(31, 37, C.yellow); c:set(32, 39, C.clay)
-- blade: lit edge and fuller
for y = 14, 35 do c:set(11, y, C.white) end
for y = 16, 34 do c:set(12, y, C.grey) end
c:set(12, 22, C.slate) -- nick in the blade
-- shield boss
c:set(47, 35, C.yellow); c:set(48, 35, C.gold); c:set(47, 36, C.gold); c:set(48, 36, C.clay)

c:outline(C.ink)

core.export("warrior", { { name = "warrior", canvas = c } }, { silhouette = true })
