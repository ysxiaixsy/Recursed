-- Automatic checks for the art exports (see art-test-brief.md).
-- Run through tools/art/check. Exit code 0 = every check passed.

local root = app.params["root"]
if not root or root == "" then
  error("missing --script-param root=<repository root>")
end
local function path(...) return app.fs.joinPath(root, ...) end
local pc = app.pixelColor

-- kind "sprite": transparent background, empty margin, dark outline.
-- kind "full": every pixel is opaque.
local ASSETS = {
  { name = "warrior", w = 64, h = 64, kind = "sprite" },
  { name = "monster", w = 80, h = 80, kind = "sprite" },
  { name = "background", w = 270, h = 480, kind = "full" },
  { name = "ui_kit", w = 270, h = 172, kind = "full" },
  { name = "battle_mockup", w = 270, h = 480, kind = "full" },
}
local SCALE = 4
local MAX_COLOURS = 32

local failures = 0
local function report(ok, asset, what, detail)
  if not ok then failures = failures + 1 end
  print(string.format("%s  %-14s %s%s", ok and "PASS" or "FAIL", asset, what,
    detail and (" - " .. detail) or ""))
end

-- Palette ---------------------------------------------------------------------
local palette, paletteCount = {}, 0
local darkest, darkestSum = nil, 1e9
do
  local f = io.open(path("art", "palette.hex"), "r")
  if f then
    for line in f:lines() do
      local hex = line:match("^%s*#?(%x%x%x%x%x%x)%s*$")
      if hex then
        local r, g, b = tonumber(hex:sub(1, 2), 16), tonumber(hex:sub(3, 4), 16), tonumber(hex:sub(5, 6), 16)
        local key = (r << 16) | (g << 8) | b
        if not palette[key] then
          palette[key] = true
          paletteCount = paletteCount + 1
        end
        if r + g + b < darkestSum then darkest, darkestSum = key, r + g + b end
      end
    end
    f:close()
  end
  report(paletteCount > 0 and paletteCount <= MAX_COLOURS, "palette.hex",
    "has 1 to " .. MAX_COLOURS .. " colours", paletteCount .. " colours")
end

-- Load a file as an RGB image. Returns image, colour mode of the file.
local function loadRGB(filename)
  if not app.fs.isFile(filename) then return nil end
  local spr = Sprite { fromFile = filename }
  if not spr then return nil end
  local img = Image(spr.width, spr.height, ColorMode.RGB)
  img:drawSprite(spr, 1)
  local mode = spr.colorMode
  spr:close()
  return img, mode
end

local used, usedCount = {}, 0

for _, a in ipairs(ASSETS) do
  local img, mode = loadRGB(path("art", "export", a.name .. ".png"))
  if not img then
    report(false, a.name, "1x export exists")
  else
    local w, h = img.width, img.height
    report(w == a.w and h == a.h, a.name, "size is " .. a.w .. " x " .. a.h, w .. " x " .. h)
    report(mode == ColorMode.INDEXED, a.name, "export is indexed colour")

    -- one pass over the pixels: alpha, palette membership, opacity map
    local opaque = {}
    local badAlpha, offPalette, transparent = 0, 0, 0
    for y = 0, h - 1 do
      for x = 0, w - 1 do
        local v = img:getPixel(x, y)
        local al = pc.rgbaA(v)
        if al == 255 then
          opaque[y * w + x] = true
          local key = (pc.rgbaR(v) << 16) | (pc.rgbaG(v) << 8) | pc.rgbaB(v)
          if not palette[key] then
            offPalette = offPalette + 1
          elseif not used[key] then
            used[key] = true
            usedCount = usedCount + 1
          end
        elseif al == 0 then
          transparent = transparent + 1
        else
          badAlpha = badAlpha + 1
        end
      end
    end
    report(badAlpha == 0, a.name, "alpha is 0 or 255 only", badAlpha .. " bad pixels")
    report(offPalette == 0, a.name, "every pixel uses a palette colour", offPalette .. " off-palette pixels")

    if a.kind == "sprite" then
      report(transparent > 0, a.name, "background is transparent")
      local edge = 0
      for x = 0, w - 1 do
        if opaque[x] or opaque[(h - 1) * w + x] then edge = edge + 1 end
      end
      for y = 0, h - 1 do
        if opaque[y * w] or opaque[y * w + w - 1] then edge = edge + 1 end
      end
      report(edge == 0, a.name, "at least 1 pixel of empty margin", edge .. " pixels on the border")
      -- every opaque pixel that touches transparency must be the outline colour
      local bad = 0
      for y = 1, h - 2 do
        for x = 1, w - 2 do
          local i = y * w + x
          if opaque[i] and not (opaque[i - 1] and opaque[i + 1] and opaque[i - w] and opaque[i + w]) then
            local v = img:getPixel(x, y)
            local key = (pc.rgbaR(v) << 16) | (pc.rgbaG(v) << 8) | pc.rgbaB(v)
            if key ~= darkest then bad = bad + 1 end
          end
        end
      end
      report(bad == 0, a.name, "dark outline all around", bad .. " edge pixels are not the outline colour")
    else
      report(transparent == 0, a.name, "no transparent pixels", transparent .. " transparent pixels")
    end

    -- 4x export: an exact nearest-neighbour copy
    local big = loadRGB(path("art", "export", SCALE .. "x", a.name .. ".png"))
    if not big then
      report(false, a.name, SCALE .. "x export exists")
    elseif big.width ~= w * SCALE or big.height ~= h * SCALE then
      report(false, a.name, SCALE .. "x export size", big.width .. " x " .. big.height)
    else
      local diff = 0
      for y = 0, h * SCALE - 1 do
        local sy = y // SCALE
        for x = 0, w * SCALE - 1 do
          if big:getPixel(x, y) ~= img:getPixel(x // SCALE, sy) then diff = diff + 1 end
        end
      end
      report(diff == 0, a.name, SCALE .. "x export is an exact nearest-neighbour scale", diff .. " different pixels")
    end
  end

  -- source file
  local srcFile = path("art", "src", a.name .. ".aseprite")
  if not app.fs.isFile(srcFile) then
    report(false, a.name, "source .aseprite exists")
  else
    local spr = Sprite { fromFile = srcFile }
    report(spr.colorMode == ColorMode.INDEXED and spr.width == a.w and spr.height == a.h and #spr.frames == 1,
      a.name, "source is indexed, same size, one frame")
    spr:close()
  end
end

report(usedCount <= MAX_COLOURS, "all assets", "total colours used is " .. MAX_COLOURS .. " or fewer",
  usedCount .. " colours")

print(failures == 0 and "ALL CHECKS PASSED" or (failures .. " CHECK(S) FAILED"))
return failures == 0 and 0 or 1
