-- Shared drawing library for the art test scripts.
--
-- Everything is drawn into a Canvas (a grid of palette indices), then written
-- to an indexed Aseprite sprite and exported. Nothing here uses random state:
-- the same script always produces the same pixels.
--
-- Palette index 0 is transparent. Indices 1..32 are the colours of
-- art/palette.hex in file order; M.C names them.

local M = {}

local root = app.params["root"]
if not root or root == "" then
  error("missing --script-param root=<repository root>")
end
M.root = root

function M.path(...)
  return app.fs.joinPath(root, ...)
end

---------------------------------------------------------------------------
-- Palette
---------------------------------------------------------------------------

-- Names for the palette.hex entries (Endesga 32, Lospec order).
M.C = {
  rust = 1, clay = 2, cream = 3, sand = 4, tan = 5, brown = 6, umber = 7,
  blood = 8, red = 9, orange = 10, gold = 11, yellow = 12,
  lime = 13, green = 14, forest = 15, teal = 16,
  deep = 17, blue = 18, cyan = 19,
  white = 20, silver = 21, grey = 22, slate = 23, dslate = 24, navy = 25, ink = 26,
  hot = 27, purple = 28, magenta = 29, pink = 30, skin = 31, skin2 = 32,
}
local C = M.C

-- Colour ramps, dark to light.
M.R = {
  steel   = { C.ink, C.navy, C.dslate, C.slate, C.grey, C.silver, C.white },
  leather = { C.ink, C.umber, C.brown, C.tan, C.sand, C.cream },
  bone    = { C.umber, C.brown, C.tan, C.sand, C.cream, C.white },
  red     = { C.ink, C.umber, C.blood, C.red, C.pink },
  gold    = { C.umber, C.brown, C.rust, C.clay, C.gold, C.yellow },
  fire    = { C.blood, C.rust, C.orange, C.gold, C.yellow, C.white },
  purple  = { C.ink, C.navy, C.purple, C.magenta, C.pink },
  green   = { C.ink, C.teal, C.forest, C.green, C.lime },
  blue    = { C.ink, C.navy, C.deep, C.blue, C.cyan, C.white },
  stone   = { C.ink, C.navy, C.dslate, C.slate, C.grey },
  earth   = { C.ink, C.umber, C.brown, C.tan },
}

local paletteRGB = nil

-- Returns the list of {r,g,b} read from art/palette.hex.
function M.paletteRGB()
  if paletteRGB then return paletteRGB end
  local fn = M.path("art", "palette.hex")
  local f = io.open(fn, "r")
  if not f then error("cannot read " .. fn) end
  local list = {}
  for line in f:lines() do
    local hex = line:match("^%s*#?(%x%x%x%x%x%x)%s*$")
    if hex then
      list[#list + 1] = {
        tonumber(hex:sub(1, 2), 16),
        tonumber(hex:sub(3, 4), 16),
        tonumber(hex:sub(5, 6), 16),
      }
    end
  end
  f:close()
  if #list == 0 or #list > 32 then
    error("palette.hex must hold 1 to 32 colours, found " .. #list)
  end
  paletteRGB = list
  return list
end

-- Aseprite Palette: entry 0 transparent, then the palette.hex colours.
function M.palette()
  local rgb = M.paletteRGB()
  local pal = Palette(#rgb + 1)
  pal:setColor(0, Color { r = 0, g = 0, b = 0, a = 0 })
  for i, c in ipairs(rgb) do
    pal:setColor(i, Color { r = c[1], g = c[2], b = c[3], a = 255 })
  end
  return pal
end

---------------------------------------------------------------------------
-- Deterministic noise and dither
---------------------------------------------------------------------------

function M.hash(x, y, seed)
  local n = (x * 374761393 + y * 668265263 + (seed or 0) * 982451653) & 0x7fffffff
  n = ((n ~ (n >> 13)) * 1274126177) & 0x7fffffff
  return ((n ~ (n >> 16)) & 0xffff) / 65536
end
local hash = M.hash

local BAYER = {
  [0] = 0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
}
-- Threshold in [0,1) from a 4x4 ordered-dither matrix.
function M.bayer(x, y)
  return (BAYER[(y % 4) * 4 + (x % 4)] + 0.5) / 16
end
local bayer = M.bayer

---------------------------------------------------------------------------
-- Signed distance shapes (negative inside). Coordinates are in pixels,
-- sampled at pixel centres.
---------------------------------------------------------------------------

local S = {}
M.S = S
local sqrt, min, max, abs, floor = math.sqrt, math.min, math.max, math.abs, math.floor

function S.circle(cx, cy, r)
  return function(x, y)
    local dx, dy = x - cx, y - cy
    return sqrt(dx * dx + dy * dy) - r
  end
end

function S.ellipse(cx, cy, rx, ry)
  local m = min(rx, ry)
  return function(x, y)
    local dx, dy = (x - cx) / rx, (y - cy) / ry
    return (sqrt(dx * dx + dy * dy) - 1) * m
  end
end

-- Rounded box: centre, half sizes, corner radius.
function S.box(cx, cy, hw, hh, r)
  r = r or 0
  return function(x, y)
    local qx, qy = abs(x - cx) - hw + r, abs(y - cy) - hh + r
    local ox, oy = max(qx, 0), max(qy, 0)
    return sqrt(ox * ox + oy * oy) + min(max(qx, qy), 0) - r
  end
end

-- Segment with a radius that goes from r1 to r2.
function S.capsule(x1, y1, x2, y2, r1, r2)
  r2 = r2 or r1
  local ex, ey = x2 - x1, y2 - y1
  local ee = ex * ex + ey * ey
  return function(x, y)
    local wx, wy = x - x1, y - y1
    local t = ee > 0 and (wx * ex + wy * ey) / ee or 0
    if t < 0 then t = 0 elseif t > 1 then t = 1 end
    local dx, dy = wx - ex * t, wy - ey * t
    return sqrt(dx * dx + dy * dy) - (r1 + (r2 - r1) * t)
  end
end

-- Polygon from a flat list {x1,y1,x2,y2,...}. Optional rounding radius.
function S.poly(pts, r)
  local n = #pts // 2
  r = r or 0
  return function(x, y)
    local d = math.huge
    local inside = false
    local jx, jy = pts[2 * n - 1], pts[2 * n]
    for i = 1, n do
      local ix, iy = pts[2 * i - 1], pts[2 * i]
      local ex, ey = ix - jx, iy - jy
      local wx, wy = x - jx, y - jy
      local t = (wx * ex + wy * ey) / (ex * ex + ey * ey)
      if t < 0 then t = 0 elseif t > 1 then t = 1 end
      local dx, dy = wx - ex * t, wy - ey * t
      local dd = dx * dx + dy * dy
      if dd < d then d = dd end
      if ((iy > y) ~= (jy > y)) and (x < (jx - ix) * (y - iy) / (jy - iy) + ix) then
        inside = not inside
      end
      jx, jy = ix, iy
    end
    d = sqrt(d)
    return (inside and -d or d) - r
  end
end

function S.union(...)
  local fs = { ... }
  return function(x, y)
    local d = fs[1](x, y)
    for i = 2, #fs do
      local e = fs[i](x, y)
      if e < d then d = e end
    end
    return d
  end
end

function S.inter(...)
  local fs = { ... }
  return function(x, y)
    local d = fs[1](x, y)
    for i = 2, #fs do
      local e = fs[i](x, y)
      if e > d then d = e end
    end
    return d
  end
end

function S.sub(a, b)
  return function(x, y)
    return max(a(x, y), -b(x, y))
  end
end

-- Grow (r > 0) or shrink (r < 0) a shape.
function S.offset(f, r)
  return function(x, y) return f(x, y) - r end
end

-- Mirror a shape across the vertical line x = cx.
function S.mirror(f, cx)
  return function(x, y) return f(2 * cx - x, y) end
end

function S.move(f, dx, dy)
  return function(x, y) return f(x - dx, y - dy) end
end

---------------------------------------------------------------------------
-- Lighting: one light, from the top left, for every asset.
---------------------------------------------------------------------------

local LX, LY, LZ = -0.50, -0.62, 0.60
M.LIGHT = { LX, LY, LZ }

-- Light intensity -> shade offset from the base level (piecewise linear).
-- A flat surface facing the viewer (I = LZ) maps close to 0.
local VMAP = { -1.0, -2.7, -0.8, -2.4, -0.1, -1.5, 0.35, -0.5, 0.75, 0.5, 0.93, 1.5, 1.0, 1.9 }
local function vmap(i)
  if i <= VMAP[1] then return VMAP[2] end
  for k = 3, #VMAP, 2 do
    if i <= VMAP[k] then
      local i0, v0, i1, v1 = VMAP[k - 2], VMAP[k - 1], VMAP[k], VMAP[k + 1]
      return v0 + (v1 - v0) * (i - i0) / (i1 - i0)
    end
  end
  return VMAP[#VMAP]
end

-- A material: a ramp, the level a flat surface gets, and shading options.
--   bevel  : distance from the edge over which the surface turns (large = dome)
--   gain   : contrast multiplier
--   noise  : amplitude of per-pixel texture, in levels
--   dither : use ordered dither between levels
--   lo, hi : clamp for the level
function M.mat(ramp, base, o)
  local m = { ramp = ramp, base = base }
  if o then for k, v in pairs(o) do m[k] = v end end
  return m
end

---------------------------------------------------------------------------
-- Canvas
---------------------------------------------------------------------------

local Canvas = {}
Canvas.__index = Canvas

function M.canvas(w, h)
  local c = setmetatable({ w = w, h = h, col = {}, ramp = {}, lvl = {}, part = {} }, Canvas)
  for i = 0, w * h - 1 do
    c.col[i] = 0
    c.part[i] = 0
  end
  c.partId = 0
  c.partOpt = { [0] = {} }
  return c
end

function Canvas:inb(x, y)
  return x >= 0 and y >= 0 and x < self.w and y < self.h
end

function Canvas:get(x, y)
  if x < 0 or y < 0 or x >= self.w or y >= self.h then return 0 end
  return self.col[y * self.w + x]
end

-- Set a pixel to a fixed palette colour.
function Canvas:set(x, y, color)
  if x < 0 or y < 0 or x >= self.w or y >= self.h then return end
  local i = y * self.w + x
  if self.col[i] == 0 and color ~= 0 then self.part[i] = self.partId end
  self.col[i] = color
  self.ramp[i] = nil
  self.lvl[i] = nil
  if color == 0 then self.part[i] = 0 end
end

-- Set a pixel to a level of a ramp (it can still be shaded afterwards).
function Canvas:setr(x, y, ramp, lvl)
  if x < 0 or y < 0 or x >= self.w or y >= self.h then return end
  local i = y * self.w + x
  if lvl < 1 then lvl = 1 elseif lvl > #ramp then lvl = #ramp end
  if self.col[i] == 0 then self.part[i] = self.partId end
  self.col[i] = ramp[lvl]
  self.ramp[i] = ramp
  self.lvl[i] = lvl
end

-- Move a ramp pixel up or down its ramp.
function Canvas:shade(x, y, delta)
  if x < 0 or y < 0 or x >= self.w or y >= self.h then return end
  local i = y * self.w + x
  local ramp = self.ramp[i]
  if not ramp then return end
  local l = self.lvl[i] + delta
  if l < 1 then l = 1 elseif l > #ramp then l = #ramp end
  self.lvl[i] = l
  self.col[i] = ramp[l]
end

function Canvas:rect(x, y, w, h, color)
  for yy = y, y + h - 1 do
    for xx = x, x + w - 1 do self:set(xx, yy, color) end
  end
end

function Canvas:frame(x, y, w, h, color)
  for xx = x, x + w - 1 do
    self:set(xx, y, color)
    self:set(xx, y + h - 1, color)
  end
  for yy = y, y + h - 1 do
    self:set(x, yy, color)
    self:set(x + w - 1, yy, color)
  end
end

function Canvas:hline(x, y, w, color)
  for xx = x, x + w - 1 do self:set(xx, y, color) end
end

function Canvas:vline(x, y, h, color)
  for yy = y, y + h - 1 do self:set(x, yy, color) end
end

-- Bresenham line.
function Canvas:line(x0, y0, x1, y1, color)
  local dx, dy = abs(x1 - x0), -abs(y1 - y0)
  local sx, sy = x0 < x1 and 1 or -1, y0 < y1 and 1 or -1
  local err = dx + dy
  while true do
    self:set(x0, y0, color)
    if x0 == x1 and y0 == y1 then break end
    local e2 = 2 * err
    if e2 >= dy then err = err + dy; x0 = x0 + sx end
    if e2 <= dx then err = err + dx; y0 = y0 + sy end
  end
end

-- Pixels from rows of text. `map` gives the palette colour for each
-- character; characters that are not in the map are skipped.
function Canvas:stamp(x, y, rows, map)
  for j, row in ipairs(rows) do
    for i = 1, #row do
      local col = map[row:sub(i, i)]
      if col then self:set(x + i - 1, y + j - 1, col) end
    end
  end
end

-- Start a new part. Parts drawn later are in front of earlier parts.
--   sep = false : no separation line is drawn around this part
function Canvas:newPart(opt)
  self.partId = self.partId + 1
  self.partOpt[self.partId] = opt or {}
  return self.partId
end

-- Fill a shape with a shaded material.
--   o.base, o.bevel, o.gain, o.noise, o.dither, o.lo, o.hi : override material
--   o.flat  : no lighting, only base level (+ mod / noise)
--   o.mod   : function(x, y, d) -> extra shade offset
--   o.clip  : second shape; only pixels inside both are drawn
--   o.decal : only draw over pixels of this part id, and keep their part
--   o.box   : {x0, y0, x1, y1} pixel bounds to scan
function Canvas:fill(sdf, mat, o)
  o = o or {}
  local ramp = o.ramp or mat.ramp
  local n = #ramp
  local base = o.base or mat.base
  local R = o.bevel or mat.bevel or 3
  local gain = o.gain or mat.gain or 1
  local noise = o.noise or mat.noise or 0
  local dither = o.dither
  if dither == nil then dither = mat.dither end
  local lo = o.lo or mat.lo or 1
  local hi = o.hi or mat.hi or n
  local seed = o.seed or mat.seed or 0
  local flat = o.flat or mat.flat
  local mod, clip, decal = o.mod, o.clip, o.decal
  local gmod = self.gmod -- canvas-wide shade offset, function(x, y)
  local part = self.partId
  local x0, y0, x1, y1 = 0, 0, self.w - 1, self.h - 1
  if o.box then
    x0, y0 = max(0, o.box[1]), max(0, o.box[2])
    x1, y1 = min(x1, o.box[3]), min(y1, o.box[4])
  end
  local w = self.w
  for y = y0, y1 do
    for x = x0, x1 do
      local px, py = x + 0.5, y + 0.5
      local d = sdf(px, py)
      local i = y * w + x
      if d < 0 and (not clip or clip(px, py) < 0) and (not decal or self.part[i] == decal) then
        local v = 0
        if not flat then
          local gx = sdf(px + 0.5, py) - sdf(px - 0.5, py)
          local gy = sdf(px, py + 0.5) - sdf(px, py - 0.5)
          local gl = sqrt(gx * gx + gy * gy)
          if gl > 1e-6 then gx, gy = gx / gl, gy / gl else gx, gy = 0, 0 end
          local t = 1 + d / R
          if t < 0 then t = 0 end
          local nz = sqrt(1 - t * t)
          v = vmap(gx * t * LX + gy * t * LY + nz * LZ) * gain
        end
        if mod then v = v + mod(px, py, d) end
        if gmod then v = v + gmod(px, py) end
        if noise > 0 then v = v + (hash(x, y, seed) - 0.5) * noise end
        local lvl
        if dither then
          lvl = base + floor(v + bayer(x, y))
        else
          lvl = base + floor(v + 0.5)
        end
        if lvl < lo then lvl = lo elseif lvl > hi then lvl = hi end
        self.col[i] = ramp[lvl]
        self.ramp[i] = ramp
        self.lvl[i] = lvl
        if not decal then self.part[i] = part end
      end
    end
  end
end

-- Shade one pixel, but only if it belongs to the given part.
function Canvas:shadeOn(part, x, y, delta)
  if x < 0 or y < 0 or x >= self.w or y >= self.h then return end
  if self.part[y * self.w + x] == part then self:shade(x, y, delta) end
end

-- Shift the level of every ramp pixel inside a shape.
--   o.parts : set {[id]=true} of parts that may change (default: all)
function Canvas:shadeMask(sdf, delta, o)
  o = o or {}
  for y = 0, self.h - 1 do
    for x = 0, self.w - 1 do
      local i = y * self.w + x
      if self.ramp[i] and (not o.parts or o.parts[self.part[i]]) and sdf(x + 0.5, y + 0.5) < 0 then
        self:shade(x, y, delta)
      end
    end
  end
end

-- Drop shadows: a pixel gets darker when a part in front of it lies
-- up and to the left (where the light comes from).
function Canvas:castShadows(len, delta)
  len = len or 1
  delta = delta or -1
  local w, h = self.w, self.h
  local hits = {}
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local i = y * w + x
      local p = self.part[i]
      if p > 0 and self.ramp[i] then
        for k = 1, len do
          local sx, sy = x - k, y - k
          if sx >= 0 and sy >= 0 then
            local q = self.part[sy * w + sx]
            if q > p and self.partOpt[q].shadow ~= false then
              hits[#hits + 1] = i
              break
            end
          end
        end
      end
    end
  end
  for _, i in ipairs(hits) do
    self:shade(i % w, i // w, delta)
  end
end

-- Separation lines: where a part touches a part in front of it, the pixel
-- of the part behind is darkened.
--   drop : levels to go down (default 2)
--   cap  : the result is never lighter than this level (default 3)
function Canvas:separate(drop, cap)
  drop = drop or 2
  cap = cap or 3
  local w, h = self.w, self.h
  local hits = {}
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local i = y * w + x
      local p = self.part[i]
      if p > 0 and self.ramp[i] then
        local q = 0
        if x > 0 then q = max(q, self.part[i - 1]) end
        if x < w - 1 then q = max(q, self.part[i + 1]) end
        if y > 0 then q = max(q, self.part[i - w]) end
        if y < h - 1 then q = max(q, self.part[i + w]) end
        if q > p and self.partOpt[q].sep ~= false then hits[#hits + 1] = i end
      end
    end
  end
  for _, i in ipairs(hits) do
    local l = min(self.lvl[i] - drop, cap)
    if l < 1 then l = 1 end
    self.lvl[i] = l
    self.col[i] = self.ramp[i][l]
  end
end

-- Outline: every transparent pixel that touches the shape (4 directions)
-- becomes `color`. The outline is outside the shape and 1 pixel wide.
function Canvas:outline(color)
  local w, h = self.w, self.h
  local hits = {}
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local i = y * w + x
      if self.col[i] == 0 then
        if (x > 0 and self.col[i - 1] ~= 0) or (x < w - 1 and self.col[i + 1] ~= 0)
            or (y > 0 and self.col[i - w] ~= 0) or (y < h - 1 and self.col[i + w] ~= 0) then
          hits[#hits + 1] = i
        end
      end
    end
  end
  for _, i in ipairs(hits) do
    self.col[i] = color
    self.ramp[i] = nil
    self.lvl[i] = nil
  end
end

-- Bounds {x0, y0, x1, y1} of the non-transparent pixels, or nil.
function Canvas:bounds()
  local x0, y0, x1, y1 = self.w, self.h, -1, -1
  for y = 0, self.h - 1 do
    for x = 0, self.w - 1 do
      if self.col[y * self.w + x] ~= 0 then
        if x < x0 then x0 = x end
        if x > x1 then x1 = x end
        if y < y0 then y0 = y end
        if y > y1 then y1 = y end
      end
    end
  end
  if x1 < 0 then return nil end
  return { x0, y0, x1, y1 }
end

-- Copy pixels from another canvas. Transparent source pixels are skipped.
--   o.sx, o.sy, o.sw, o.sh : source rectangle (default: all)
--   o.opaque : also copy transparent pixels
function Canvas:blit(src, dx, dy, o)
  o = o or {}
  local sx, sy = o.sx or 0, o.sy or 0
  local sw, sh = o.sw or (src.w - sx), o.sh or (src.h - sy)
  for y = 0, sh - 1 do
    for x = 0, sw - 1 do
      local c = src:get(sx + x, sy + y)
      if c ~= 0 or o.opaque then
        local tx, ty = dx + x, dy + y
        if tx >= 0 and ty >= 0 and tx < self.w and ty < self.h then
          local i = ty * self.w + tx
          self.col[i] = c
          self.ramp[i] = nil
          self.lvl[i] = nil
        end
      end
    end
  end
end

function Canvas:toImage(scale)
  scale = scale or 1
  local w, h = self.w, self.h
  local img = Image(ImageSpec {
    width = w * scale, height = h * scale,
    colorMode = ColorMode.INDEXED, transparentColor = 0,
  })
  img:clear(0)
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      local c = self.col[y * w + x]
      if c ~= 0 then
        if scale == 1 then
          img:drawPixel(x, y, c)
        else
          for yy = 0, scale - 1 do
            for xx = 0, scale - 1 do
              img:drawPixel(x * scale + xx, y * scale + yy, c)
            end
          end
        end
      end
    end
  end
  return img
end

-- Canvas from an indexed image file (PNG or .aseprite, first frame).
function M.load(filename)
  local img = Image { fromFile = filename }
  if not img then error("cannot load " .. filename) end
  if img.colorMode ~= ColorMode.INDEXED then
    error(filename .. " is not an indexed image")
  end
  local c = M.canvas(img.width, img.height)
  for y = 0, img.height - 1 do
    for x = 0, img.width - 1 do
      c.col[y * img.width + x] = img:getPixel(x, y)
    end
  end
  return c
end

-- One canvas from a list of layers {name=, canvas=}, bottom layer first.
function M.flatten(layers)
  local first = layers[1].canvas
  local out = M.canvas(first.w, first.h)
  for _, l in ipairs(layers) do out:blit(l.canvas, 0, 0) end
  return out
end

---------------------------------------------------------------------------
-- Export
---------------------------------------------------------------------------

-- Writes art/src/<name>.aseprite, art/export/<name>.png and
-- art/export/4x/<name>.png.
--   layers : list of {name=, canvas=}, bottom layer first
--   o.slices : list of {name=, x=, y=, w=, h=, center={x,y,w,h}}
function M.export(name, layers, o)
  o = o or {}
  local w, h = layers[1].canvas.w, layers[1].canvas.h
  app.fs.makeAllDirectories(M.path("art", "src"))
  app.fs.makeAllDirectories(M.path("art", "export", "4x"))

  local pal = M.palette()
  local spr = Sprite(ImageSpec {
    width = w, height = h, colorMode = ColorMode.INDEXED, transparentColor = 0,
  })
  spr:setPalette(pal)
  for i, l in ipairs(layers) do
    local img = l.canvas:toImage()
    if i == 1 then
      spr.layers[1].name = l.name
      spr.cels[1].image = img
      spr.cels[1].position = Point(0, 0)
    else
      local layer = spr:newLayer()
      layer.name = l.name
      spr:newCel(layer, 1, img, Point(0, 0))
    end
  end
  for _, s in ipairs(o.slices or {}) do
    local slice = spr:newSlice(Rectangle(s.x, s.y, s.w, s.h))
    slice.name = s.name
    if s.center then
      slice.center = Rectangle(s.center[1], s.center[2], s.center[3], s.center[4])
    end
  end

  local srcFile = M.path("art", "src", name .. ".aseprite")
  local pngFile = M.path("art", "export", name .. ".png")
  local png4File = M.path("art", "export", "4x", name .. ".png")
  spr:saveAs(srcFile)
  spr:saveCopyAs(pngFile)
  spr:close()

  local flat = M.flatten(layers)
  flat:toImage(4):saveAs { filename = png4File, palette = pal }

  -- Aseprite only prints a message when a save fails, so read the export
  -- back and stop if it is not what was drawn.
  local back = app.fs.isFile(pngFile) and Image { fromFile = pngFile } or nil
  if not back or back.width ~= w or back.height ~= h then
    error("export failed: " .. pngFile)
  end
  for y = 0, h - 1 do
    for x = 0, w - 1 do
      if back:getPixel(x, y) ~= flat.col[y * w + x] then
        error(string.format("export failed: %s differs at %d,%d (file not written?)", pngFile, x, y))
      end
    end
  end

  local preview = app.params["preview"]
  if preview and preview ~= "" then
    M.preview(flat, app.fs.joinPath(preview, name .. ".png"), o.previewScale, o.silhouette)
  end
  print(string.format("%s: %dx%d -> %s", name, w, h, pngFile))
end

-- Working preview, not an export: the asset enlarged on a dungeon-coloured
-- ground, and (for sprites) its silhouette beside it.
function M.preview(flat, filename, scale, silhouette)
  scale = scale or 6
  local w, h = flat.w, flat.h
  local cols = silhouette and 2 or 1
  local out = M.canvas(w * cols + (cols - 1) * 2, h)
  for i = 0, out.w * out.h - 1 do out.col[i] = C.dslate end
  out:blit(flat, 0, 0)
  if silhouette then
    for y = 0, h - 1 do
      for x = 0, w - 1 do
        out.col[y * out.w + w + 2 + x] = flat.col[y * w + x] ~= 0 and C.ink or C.grey
      end
    end
  end
  app.fs.makeAllDirectories(app.fs.filePath(filename))
  out:toImage(scale):saveAs { filename = filename, palette = M.palette() }
end

return M
