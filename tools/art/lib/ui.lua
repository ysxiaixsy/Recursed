-- UI widgets. The UI kit sheet and the battle mockup both draw with these
-- functions, so the kit and the mockup cannot drift apart.
--
-- Usage: local ui = dofile("lib/ui.lua")(core)

return function(core)
  local font = dofile("lib/font.lua")
  local C, R, S, mat = core.C, core.R, core.S, core.mat
  local U = { font = font }

  -------------------------------------------------------------------------
  -- Nine-slice frames
  -------------------------------------------------------------------------

  U.TILE, U.INSET = 32, 8

  -- Build a 32 x 32 frame tile from rings of colour, outside ring first.
  -- Each ring is {topLeftColour, bottomRightColour}.
  local function frameTile(rings, fill, studs)
    local n = U.TILE
    local t = core.canvas(n, n)
    for y = 0, n - 1 do
      for x = 0, n - 1 do
        local d = math.min(x, y, n - 1 - x, n - 1 - y)
        local ring = rings[d + 1]
        local col = fill
        if ring then
          local lit = (x == d or y == d) and not (x == n - 1 - d or y == n - 1 - d)
          col = lit and ring[1] or ring[2]
        end
        t.col[y * n + x] = col
      end
    end
    -- cut the outer corners for a softer shape
    t.col[0] = 0; t.col[n - 1] = 0; t.col[(n - 1) * n] = 0; t.col[n * n - 1] = 0
    if studs then
      for _, p in ipairs({ { 3, 3 }, { n - 5, 3 }, { 3, n - 5 }, { n - 5, n - 5 } }) do
        t.col[p[2] * n + p[1]] = C.yellow
        t.col[p[2] * n + p[1] + 1] = C.gold
        t.col[(p[2] + 1) * n + p[1]] = C.gold
        t.col[(p[2] + 1) * n + p[1] + 1] = C.rust
      end
    end
    return t
  end

  local STYLES = {
    -- main window
    panel = function()
      return frameTile({ { C.ink, C.ink }, { C.slate, C.dslate }, { C.dslate, C.navy },
        { C.ink, C.ink }, { C.navy, C.navy }, { C.navy, C.navy } }, C.navy, true)
    end,
    -- recessed well
    inset = function()
      return frameTile({ { C.ink, C.ink }, { C.ink, C.dslate } }, C.ink)
    end,
    button = function()
      return frameTile({ { C.ink, C.ink }, { C.slate, C.navy }, { C.dslate, C.dslate } }, C.dslate)
    end,
    button_sel = function()
      return frameTile({ { C.ink, C.ink }, { C.yellow, C.clay }, { C.gold, C.rust },
        { C.slate, C.dslate } }, C.dslate)
    end,
    button_dis = function()
      return frameTile({ { C.ink, C.ink }, { C.dslate, C.ink }, { C.navy, C.navy } }, C.navy)
    end,
  }
  local tiles = {}
  function U.tile(style)
    if not tiles[style] then tiles[style] = STYLES[style]() end
    return tiles[style]
  end

  -- Draw a tile stretched to w x h. Corners keep their size; edges and
  -- centre repeat.
  function U.nineSlice(c, tile, inset, x, y, w, h)
    local n = tile.w
    local mid = n - 2 * inset
    local function src(d, len)
      if d < inset then return d end
      if d >= len - inset then return n - (len - d) end
      return inset + (d - inset) % mid
    end
    for dy = 0, h - 1 do
      local sy = src(dy, h)
      for dx = 0, w - 1 do
        local col = tile.col[sy * n + src(dx, w)]
        if col ~= 0 then c:set(x + dx, y + dy, col) end
      end
    end
  end

  function U.panel(c, x, y, w, h, style)
    U.nineSlice(c, U.tile(style or "panel"), U.INSET, x, y, w, h)
  end

  -------------------------------------------------------------------------
  -- Icons, drawn with the same shaded shapes as the sprites
  -------------------------------------------------------------------------

  local steel   = mat(R.steel, 5, { bevel = 1.6 })
  local leather = mat(R.leather, 4, { bevel = 1.4 })
  local gold    = mat(R.gold, 5, { bevel = 1.3 })
  local cloth   = mat(R.red, 4, { bevel = 5 })

  local ICONS = {}

  function ICONS.slash()
    local c = core.canvas(24, 24)
    c:newPart() -- swoosh
    c:fill(S.sub(S.circle(11.5, 12.5, 9.6), S.circle(14.2, 15.2, 10.2)), mat(R.blue, 5, { bevel = 2 }))
    c:newPart() -- blade
    c:fill(S.poly({ 7.4, 14.4, 17.5, 4.7, 20.6, 3.4, 19.3, 6.5, 9.6, 16.6 }), steel, { base = 6, lo = 4 })
    c:newPart()
    c:fill(S.capsule(8.5, 15.5, 5.3, 18.7, 1.0), leather)
    c:fill(S.capsule(6.0, 13.0, 11.0, 18.0, 1.1), gold)
    c:fill(S.circle(4.7, 19.3, 1.5), gold)
    c:separate(2, 3)
    c:outline(C.ink)
    return c
  end

  function ICONS.cleave()
    local c = core.canvas(24, 24)
    c:newPart() -- handle
    c:fill(S.capsule(4.8, 20.8, 14.6, 5.4, 1.2), leather)
    c:newPart() -- axe head: a wedge from the haft, cut by a round edge
    local blade = S.inter(
      S.poly({ 12.6, 4.2, 19.5, 1.6, 22.6, 13.8, 14.8, 9.6 }),
      S.circle(13.0, 9.0, 9.4))
    c:fill(blade, steel, { base = 5, bevel = 2.4 })
    c:newPart() -- back spike and socket
    c:fill(S.poly({ 12.8, 4.6, 9.2, 3.6, 12.0, 7.4 }), steel, { base = 4, bevel = 1.2 })
    c:fill(S.capsule(12.6, 5.0, 14.6, 8.6, 1.3), gold)
    c:separate(2, 3)
    c:outline(C.ink)
    return c
  end

  function ICONS.guard()
    local c = core.canvas(24, 24)
    local shield = S.poly({ 5, 4, 19, 4, 19, 12, 17, 16.6, 12, 20.6, 7, 16.6, 5, 12 }, 0.7)
    c:newPart()
    c:fill(shield, gold, { bevel = 1.6 })
    local field = S.offset(shield, -2.0)
    local p = c:newPart({ sep = false })
    c:fill(field, cloth, { bevel = 7 })
    c:fill(S.union(S.box(12, 12, 1.1, 8, 0), S.box(12, 9.6, 5, 1.1, 0)), mat(R.bone, 5),
      { clip = S.offset(field, -1.0), bevel = 7, decal = p })
    c:outline(C.ink)
    return c
  end

  function ICONS.warcry()
    local c = core.canvas(24, 24)
    local flame = S.union(
      S.circle(12, 15, 6.0),
      S.poly({ 6.4, 13.5, 11.5, 2.5, 17.2, 13 }),
      S.poly({ 13.5, 12, 18.4, 6.2, 18.2, 15 }),
      S.poly({ 6.0, 15, 5.6, 8.6, 9.5, 13 }))
    local fire = mat(R.fire, 2, { flat = true })
    c:newPart({ sep = false })
    c:fill(flame, fire, { base = 2 })
    c:fill(S.move(S.offset(flame, -1.6), 0, 0.8), fire, { base = 3 })
    c:fill(S.move(S.offset(flame, -3.0), 0, 1.6), fire, { base = 4 })
    c:fill(S.move(S.offset(flame, -4.4), 0, 2.4), fire, { base = 5 })
    c:fill(S.circle(12, 17.6, 1.4), fire, { base = 6 })
    c:outline(C.ink)
    return c
  end

  local function potion(ramp)
    return function()
      local c = core.canvas(16, 16)
      c:newPart()
      c:fill(S.box(8, 4.6, 1.7, 1.9, 0.3), mat(R.steel, 6, { bevel = 1.2 }))
      c:newPart()
      c:fill(S.circle(8, 10.2, 4.7), mat(ramp, 4, { bevel = 5, gain = 1.2 }))
      c:newPart()
      c:fill(S.box(8, 2.3, 1.6, 0.9, 0.3), leather)
      c:separate(2, 3)
      c:set(6, 8, C.white); c:set(5, 9, C.white)
      c:outline(C.ink)
      return c
    end
  end
  ICONS.potion_red = potion(R.red)
  ICONS.potion_blue = potion(R.blue)

  function ICONS.bomb()
    local c = core.canvas(16, 16)
    c:newPart()
    c:fill(S.capsule(9.6, 5.6, 12.0, 3.2, 0.8), leather)
    c:newPart()
    c:fill(S.circle(7.5, 9.8, 4.9), mat(R.steel, 3, { bevel = 5, gain = 1.3 }))
    c:newPart()
    c:fill(S.box(8.6, 5.4, 1.6, 0.9, 0.2), mat(R.steel, 4, { bevel = 1 }))
    c:set(5, 8, C.grey); c:set(5, 7, C.silver)
    c:outline(C.ink)
    c:set(13, 2, C.yellow); c:set(12, 1, C.gold); c:set(14, 1, C.orange); c:set(13, 3, C.orange)
    c:set(13, 1, C.white)
    return c
  end

  local icons = {}
  function U.icon(name)
    if not icons[name] then icons[name] = ICONS[name]() end
    return icons[name]
  end

  -- Small flat icons for the bars.
  local function heart(c, x, y)
    c:stamp(x, y, {
      " pr rr ",
      "prrrrrb",
      "rrrrrrb",
      " rrrrb ",
      "  rrb  ",
      "   b   ",
    }, { p = C.pink, r = C.red, b = C.blood })
  end
  local function flame(c, x, y)
    c:stamp(x, y, {
      "   o   ",
      "  oo   ",
      "  oyo  ",
      " oyyo  ",
      " oywyo ",
      " oywyo ",
      "  ooo  ",
    }, { o = C.orange, y = C.yellow, w = C.white })
  end
  U.heart, U.flame = heart, flame

  -- Portraits are cut from the sprite exports, so they always match.
  local portraits = {}
  function U.portrait(kind)
    if not portraits[kind] then
      local spec = kind == "ally"
          and { file = "warrior.png", x = 23, y = 3, bg = C.navy }
          or { file = "monster.png", x = 31, y = 39, bg = C.umber }
      local src = core.load(core.path("art", "export", spec.file))
      local p = core.canvas(18, 18)
      for i = 0, 18 * 18 - 1 do p.col[i] = spec.bg end
      p:blit(src, 0, 0, { sx = spec.x, sy = spec.y, sw = 18, sh = 18 })
      portraits[kind] = p
    end
    return portraits[kind]
  end

  -------------------------------------------------------------------------
  -- Widgets
  -------------------------------------------------------------------------

  -- Turn-order marker, 22 x 22. kind: "ally" or "enemy".
  U.MARKER = 22
  function U.marker(c, x, y, kind, active)
    local n = U.MARKER
    local a, b = C.blue, C.deep
    if kind == "enemy" then a, b = C.red, C.blood end
    local o1, o2 = C.ink, C.ink
    if active then o1, o2 = C.yellow, C.gold end
    for d = 0, 1 do
      local tl, br = d == 0 and o1 or a, d == 0 and o2 or b
      for i = d, n - 1 - d do
        c:set(x + i, y + d, tl); c:set(x + d, y + i, tl)
      end
      for i = d + 1, n - 1 - d do
        c:set(x + i, y + n - 1 - d, br); c:set(x + n - 1 - d, y + i, br)
      end
    end
    c:blit(U.portrait(kind), x + 2, y + 2, { opaque = true })
  end

  -- Turn bar: label and four markers. order = list of "ally"/"enemy".
  U.TURNBAR_W, U.TURNBAR_H = 160, 26
  function U.turnBar(c, x, y, order, activeIndex)
    U.panel(c, x, y, U.TURNBAR_W, U.TURNBAR_H, "panel")
    font.draw(c, x + 7, y + 10, "TURN", C.cream, C.ink)
    for i, kind in ipairs(order) do
      local mx = x + 27 + (i - 1) * 33
      U.marker(c, mx, y + 2, kind, i == activeIndex)
      if i < #order then font.draw(c, mx + 26, y + 10, ">", C.slate) end
    end
  end

  -- Speed button, 28 x 18. n = 1, 2 or 3.
  U.SPEED_W, U.SPEED_H = 28, 18
  function U.speed(c, x, y, n, active)
    U.panel(c, x, y, U.SPEED_W, U.SPEED_H, active and "button_sel" or "button")
    local colA, colT = C.slate, C.grey
    if active then colA, colT = C.gold, C.yellow end
    local w = n * 4 - 1 + 3 + font.width(n .. "x")
    local px = x + (U.SPEED_W - w) // 2
    for i = 1, n do
      c:stamp(px, y + 6, { "#  ", "## ", "###", "## ", "#  " }, { ["#"] = colA })
      px = px + 4
    end
    font.draw(c, px + 2, y + 6, n .. "x", colT, C.ink)
  end

  -- Skill button, 60 x 46.
  --   skill = { icon=, name=, cost= (text), cooldown= (number, optional) }
  --   state = "normal" | "selected" | "cooldown"
  U.SKILL_W, U.SKILL_H = 60, 46
  function U.skill(c, x, y, skill, state)
    local style = ({ normal = "button", selected = "button_sel", cooldown = "button_dis" })[state]
    U.panel(c, x, y, U.SKILL_W, U.SKILL_H, style)
    -- icon well
    U.panel(c, x + 5, y + 5, 28, 28, "inset")
    c:rect(x + 6, y + 6, 26, 26, C.navy)
    c:blit(U.icon(skill.icon), x + 7, y + 7)
    local nameCol, costCol = C.cream, C.gold
    if state == "selected" then nameCol = C.white end
    if state == "cooldown" then
      -- dim the icon with a checker of dark pixels
      for yy = y + 6, y + 31 do
        for xx = x + 6, x + 31 do
          if (xx + yy) % 2 == 0 then c:set(xx, yy, C.ink) end
        end
      end
      c:rect(x + 14, y + 13, 10, 11, C.ink)
      c:frame(x + 14, y + 13, 10, 11, C.slate)
      font.centre(c, x + 19, y + 16, tostring(skill.cooldown), C.white)
      nameCol, costCol = C.slate, C.slate
    end
    -- rage cost or gain, with a flame
    if state == "cooldown" then
      c:stamp(x + 42, y + 8, { "   o   ", "  oo   ", "  ooo  ", " oooo  ", " ooooo ", " ooooo ", "  ooo  " },
        { o = C.dslate })
    else
      flame(c, x + 42, y + 8)
    end
    font.centre(c, x + 46, y + 19, skill.cost, costCol, C.ink)
    font.centre(c, x + 30, y + 36, skill.name, nameCol, C.ink)
  end

  -- Value bar, 9 pixels tall. kind: "hp" or "rage".
  -- Rage is cut into five segments so that it never looks like the HP bar.
  U.BAR_H = 9
  function U.bar(c, x, y, w, kind, value, maxv)
    local light, mid, dark = C.pink, C.red, C.blood
    if kind == "rage" then light, mid, dark = C.yellow, C.orange, C.rust end
    c:hline(x + 1, y, w - 2, C.ink)             -- frame with cut corners
    c:hline(x + 1, y + 8, w - 2, C.ink)
    c:vline(x, y + 1, 7, C.ink)
    c:vline(x + w - 1, y + 1, 7, C.ink)
    local iw = w - 2
    local fw = math.floor(iw * value / maxv + 0.5)
    for i = 0, iw - 1 do
      local px = x + 1 + i
      local divider = false
      if kind == "rage" then
        for k = 1, 4 do
          if i == (k * iw) // 5 then divider = true end
        end
      end
      for j = 0, 6 do
        local col
        if divider then
          col = C.ink
        elseif i < fw then
          col = (j == 0 and dark) or (j == 1 and light) or (j >= 5 and dark) or mid
          if j == 0 then col = mid end
          if j == 1 then col = light end
        else
          col = j == 0 and C.ink or C.navy
        end
        c:set(px, y + 1 + j, col)
      end
    end
    if kind == "hp" and fw > 0 and fw < iw then -- bright leading edge
      for j = 1, 5 do c:set(x + fw, y + 1 + j, light) end
    end
  end

  -- Icon + bar + value text. Returns the total width.
  function U.statBar(c, x, y, kind, value, maxv, barW)
    if kind == "hp" then heart(c, x, y + 2) else flame(c, x, y + 1) end
    U.bar(c, x + 10, y, barW, kind, value, maxv)
    local text = kind == "hp" and (value .. "/" .. maxv) or tostring(value)
    font.draw(c, x + 10 + barW + 4, y + 2, text, kind == "hp" and C.white or C.gold, C.ink)
    return 10 + barW + 4 + font.width(text)
  end

  -- Thin enemy health bar, 5 pixels tall.
  function U.miniBar(c, x, y, w, frac)
    c:rect(x, y, w, 5, C.ink)
    local fw = math.floor((w - 2) * frac + 0.5)
    for i = 0, w - 3 do
      for j = 0, 2 do
        local col = C.navy
        if i < fw then col = (j == 0 and C.pink) or (j == 2 and C.blood) or C.red end
        c:set(x + 1 + i, y + 1 + j, col)
      end
    end
  end

  -- Consumable slot, 24 x 24. item = icon name or nil for an empty slot.
  U.SLOT = 24
  function U.slot(c, x, y, item, count)
    U.panel(c, x, y, U.SLOT, U.SLOT, "inset")
    c:rect(x + 2, y + 2, 20, 20, C.navy)
    c:hline(x + 2, y + 2, 20, C.ink)
    c:vline(x + 2, y + 2, 20, C.ink)
    if item then
      c:blit(U.icon(item), x + 4, y + 4)
      font.right(c, x + 21, y + 16, "x" .. count, C.white, C.ink)
    end
  end

  return U
end
