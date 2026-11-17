-- Asset 2: Monster, 80 x 80. Floor 1 enemy: a crypt spider in a threat
-- pose (front legs raised). Wide and spiky, unlike the upright Warrior.

local core = dofile("lib/core.lua")
local C, R, S, mat = core.C, core.R, core.S, core.mat

local W, H = 80, 80
local CX = 40
local c = core.canvas(W, H)

-- Form shadow: darker away from the light (right and down).
c.gmod = function(x, y)
  local t = (x - 44) / 30 + (y - 50) / 60
  if t < 0 then t = 0 elseif t > 1 then t = 1 end
  return -0.8 * t
end

local hide    = mat(R.purple, 3, { bevel = 2.4, gain = 1.1 })
local hideFar = mat(R.purple, 3, { bevel = 2.2, hi = 3, far = true })
local body    = mat(R.purple, 3, { bevel = 12, gain = 1.1, noise = 0.7, hi = 4 })
local bone    = mat(R.bone, 5, { bevel = 1.6 })
local gore    = mat(R.red, 3, { bevel = 2.4 })

-- A leg from four points: attach, knee, ankle, tip. `m` mirrors for the
-- right side. Returns nothing; draws leg, joints and claw as three parts.
local function leg(p, r, material, m, spikes)
  local seg = S.union(
    S.capsule(p[1], p[2], p[3], p[4], r, r * 0.86),
    S.capsule(p[3], p[4], p[5], p[6], r * 0.86, r * 0.62),
    S.capsule(p[5], p[6], p[7], p[8], r * 0.62, r * 0.34))
  c:newPart()
  c:fill(m(seg), material)
  -- claw: the last third of the final segment
  local kx, ky = p[5] + (p[7] - p[5]) * 0.62, p[6] + (p[8] - p[6]) * 0.62
  c:newPart({ shadow = false })
  c:fill(m(S.capsule(kx, ky, p[7], p[8], r * 0.5, r * 0.3)), bone, { base = material.far and 3 or 5 })
  -- joints
  c:newPart({ shadow = false })
  local jo = { base = material.far and 3 or 4, bevel = 2, hi = material.far and 4 or 5 }
  c:fill(m(S.circle(p[3], p[4], r * 1.05)), material, jo)
  c:fill(m(S.circle(p[5], p[6], r * 0.8)), material, jo)
  -- hairs along the first two segments, on the outer side
  if not material.far then
    for k = 1, 2 do
      local ax, ay, bx, by = p[k * 2 - 1], p[k * 2], p[k * 2 + 1], p[k * 2 + 2]
      local ex, ey = bx - ax, by - ay
      local l = math.sqrt(ex * ex + ey * ey)
      ex, ey = ex / l, ey / l
      local nx, ny = ey, -ex              -- outer side: away from the body centre
      if nx > 0 then nx, ny = -nx, -ny end
      for _, t in ipairs({ 0.35, 0.62 }) do
        local hx, hy = ax + (bx - ax) * t, ay + (by - ay) * t
        c:fill(m(S.poly({
          hx - ex * 0.9, hy - ey * 0.9,
          hx + nx * (r + 1.9) + ex * 0.8, hy + ny * (r + 1.9) + ey * 0.8,
          hx + ex * 0.9, hy + ey * 0.9,
        })), material, { base = 3, bevel = 1 })
      end
    end
  end
  -- a spike on the knee, pointing away from the body
  if spikes then
    local dx, dy = p[3] - p[1], p[4] - p[2]
    local l = math.sqrt(dx * dx + dy * dy)
    dx, dy = dx / l, dy / l
    c:fill(m(S.poly({
      p[3] - dy * 1.3, p[4] + dx * 1.3,
      p[3] + dx * (r + 2.6), p[4] + dy * (r + 2.6),
      p[3] + dy * 1.3, p[4] - dx * 1.3,
    })), material, jo)
  end
end

local function sides(fn)
  fn(function(f) return f end)
  fn(function(f) return S.mirror(f, CX) end)
end

-- Rear legs (behind everything) -------------------------------------------------
sides(function(m)
  leg({ 31, 42, 11.5, 27.5, 4.5, 43, 4.0, 58.5 }, 2.3, hideFar, m, true)
end)

-- Abdomen, with bristles ----------------------------------------------------------
local abdomenPart = c:newPart()
local abdomen = S.ellipse(40, 26, 15.5, 13)
local function bristle(bx, by, tx, ty)
  local dx, dy = tx - bx, ty - by
  local l = math.sqrt(dx * dx + dy * dy)
  local nx, ny = -dy / l * 1.6, dx / l * 1.6
  return S.poly({ bx + nx, by + ny, tx, ty, bx - nx, by - ny })
end
local bristles = S.union(
  bristle(40, 14, 40, 9.2),
  bristle(33.5, 15.2, 31.2, 10.6), bristle(46.5, 15.2, 48.8, 10.6),
  bristle(28, 19.5, 24.4, 15.8), bristle(52, 19.5, 55.6, 15.8),
  bristle(25.5, 26, 21.6, 24.2), bristle(54.5, 26, 58.4, 24.2))
c:fill(S.union(abdomen, bristles), body)
-- gloss: a thin crescent on the light side
c:fill(S.sub(S.ellipse(40, 26, 12.6, 10.2), S.ellipse(41.6, 27.8, 12.8, 10.4)), body,
  { flat = true, base = 5, hi = 5, noise = 0, decal = abdomenPart, clip = S.box(33, 20, 7, 6) })
-- dark warts
for _, p in ipairs({ { 30, 27 }, { 33, 33 }, { 47, 21 }, { 50, 28 }, { 46, 34 }, { 28, 22 }, { 51, 33 } }) do
  c:shadeOn(abdomenPart, p[1], p[2], -1)
  c:shadeOn(abdomenPart, p[1] + 1, p[2], -1)
  c:shadeOn(abdomenPart, p[1], p[2] - 1, 1)
end
-- red hourglass marking
local mark = S.union(
  S.poly({ 35.6, 17.5, 44.4, 17.5, 40, 24.6 }),
  S.poly({ 40, 24.2, 45.2, 32.6, 34.8, 32.6 }))
c:fill(mark, mat(R.red, 4, { bevel = 12, gain = 1.1, lo = 3 }), { decal = abdomenPart, clip = S.offset(abdomen, -1.5) })
c:fill(S.sub(S.offset(mark, 1.0), mark), body, { flat = true, base = 1, noise = 0, decal = abdomenPart, clip = S.offset(abdomen, -1.5) })

-- Middle legs -----------------------------------------------------------------------
sides(function(m)
  leg({ 30, 47, 13, 36.5, 7, 55, 8, 72.5 }, 2.6, hide, m, true)
end)

-- Raised front legs -----------------------------------------------------------------
sides(function(m)
  leg({ 33, 45, 21.5, 25, 16.5, 10.5, 21.5, 3.6 }, 2.7, hide, m, false)
end)

-- Head ------------------------------------------------------------------------------
local headPart = c:newPart()
local head = S.ellipse(40, 47.5, 11.5, 9.5)
c:fill(head, body, { bevel = 8 })

-- Front walking legs ------------------------------------------------------------------
sides(function(m)
  leg({ 31.5, 51.5, 20.5, 45.5, 17, 60, 21, 75 }, 2.7, hide, m, true)
end)

-- Jaws --------------------------------------------------------------------------------
sides(function(m)
  c:newPart() -- palps
  c:fill(m(S.capsule(34.2, 54.5, 32.4, 61, 2.1, 1.3)), hide)
end)
sides(function(m)
  c:newPart()
  c:fill(m(S.ellipse(37.0, 56.2, 2.7, 3.5)), gore, { base = 3 })
  c:newPart({ shadow = false })
  c:fill(m(S.poly({ 35.6, 58.2, 38.6, 58.2, 39.4, 62, 38.9, 66.4, 37.2, 62.5 })), bone)
end)

-- Lighting passes -------------------------------------------------------------------------
c:castShadows(2, -1)
c:separate(2, 2)

-- Eyes: dark sockets, hot red, a glint on the light side ------------------------------------
local eye = { H = C.hot, w = C.white, b = C.blood, k = C.ink, y = C.yellow }
local function bigEye(x, y)
  c:stamp(x, y, {
    " kkkk ",
    "kkHHkk",
    "kHwHHk",
    "kHHHbk",
    "kkHbkk",
    " kkkk ",
  }, eye)
end
bigEye(33, 44)
bigEye(41, 44)
local function midEye(x, y)
  c:stamp(x, y, {
    " kk ",
    "kwHk",
    "kHbk",
    " kk ",
  }, eye)
end
midEye(29, 42)
midEye(47, 42)
midEye(36, 40)
midEye(40, 40)
c:set(33, 41, C.hot); c:set(46, 41, C.hot)

-- venom on the fangs
c:set(38, 65, C.lime); c:set(41, 65, C.lime)
c:set(38, 64, C.green); c:set(41, 64, C.green)

c:outline(C.ink)

core.export("monster", { { name = "monster", canvas = c } }, { silhouette = true })
