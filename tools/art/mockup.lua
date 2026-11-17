-- Asset 5: Battle mockup, 270 x 480. Background + 1 Warrior + 2 monsters
-- + full UI, composed from the other four assets. Run those first.
-- The layout (enemies on top, party below, skills at the bottom) is for
-- this art test only.

local core = dofile("lib/core.lua")
local ui = dofile("lib/ui.lua")(core)
local C, font, bayer = core.C, ui.font, core.bayer

local W, H = 270, 480
local function exported(name)
  return core.load(core.path("art", "export", name .. ".png"))
end

local bg = exported("background")
local warrior = exported("warrior")
local monster = exported("monster")

local shadows = core.canvas(W, H)
local enemies = core.canvas(W, H)
local party = core.canvas(W, H)
local hud = core.canvas(W, H)

-- Soft ground shadow: solid in the middle, dithered at the rim, pushed a
-- little down and right because the light comes from the top left.
local function groundShadow(cx, cy, rx, ry)
  for y = cy - ry - 1, cy + ry + 1 do
    for x = cx - rx - 1, cx + rx + 1 do
      local dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
      local d = dx * dx + dy * dy
      if d < 0.55 or (d < 1 and bayer(x, y) > (d - 0.55) / 0.45) then
        shadows:set(x, y, C.ink)
      end
    end
  end
end

-- Enemies (upper half) ------------------------------------------------------------
local foes = { { x = 28, y = 110, hp = 1.0 }, { x = 162, y = 124, hp = 0.55 } }
for _, f in ipairs(foes) do
  groundShadow(f.x + 43, f.y + 73, 33, 6)
  enemies:blit(monster, f.x, f.y)
  ui.miniBar(hud, f.x + 18, f.y - 7, 44, f.hp)
end
-- target cursor over the first enemy
hud:stamp(foes[1].x + 36, foes[1].y - 17, {
  "kkkkkkkkk",
  "kyyyyyyyk",
  " kgyyygk ",
  "  kgygk  ",
  "   kgk   ",
  "    k    ",
}, { k = C.ink, y = C.yellow, g = C.gold })

-- Party (lower half) ----------------------------------------------------------------
local hero = { x = 103, y = 250 }
groundShadow(hero.x + 34, hero.y + 61, 19, 4)
party:blit(warrior, hero.x, hero.y)

-- Top of the screen: turn bar, floor label, speed button --------------------------------
ui.turnBar(hud, 4, 4, { "ally", "enemy", "enemy", "ally" }, 1)
ui.panel(hud, 168, 8, 64, 18, "inset")
font.centre(hud, 200, 14, "FLOOR 1", C.cream)
ui.speed(hud, 238, 8, 2, true)

-- Bottom panel: status, items, skills, description --------------------------------------
ui.panel(hud, 2, 362, 266, 116, "panel")

ui.marker(hud, 9, 369, "ally", false)
local nx = font.draw(hud, 36, 369, "WARRIOR", C.cream, C.ink)
font.draw(hud, nx + 4, 369, "LV 3", C.slate, C.ink)
ui.statBar(hud, 36, 376, "hp", 84, 120, 96)
ui.statBar(hud, 36, 386, "rage", 60, 100, 96)

local items = { { "potion_red", 3 }, { "potion_blue", 1 }, { "bomb", 2 } }
for i, it in ipairs(items) do
  ui.slot(hud, 185 + (i - 1) * 26, 370, it[1], it[2])
end

local skills = {
  { icon = "slash", name = "SLASH", cost = "+10" },
  { icon = "cleave", name = "CLEAVE", cost = "30" },
  { icon = "guard", name = "GUARD", cost = "10" },
  { icon = "warcry", name = "WARCRY", cost = "50", cooldown = 2 },
}
local states = { "selected", "normal", "normal", "cooldown" }
for i, s in ipairs(skills) do
  ui.skill(hud, 9 + (i - 1) * 64, 399, s, states[i])
end

ui.panel(hud, 9, 449, 252, 22, "inset")
local tx = font.draw(hud, 14, 453, "SLASH:", C.gold)
font.draw(hud, tx + 3, 453, "HIT ONE ENEMY FOR 100% ATTACK.", C.cream)
font.draw(hud, 14, 461, "GAIN 10 RAGE.", C.grey)

core.export("battle_mockup", {
  { name = "background", canvas = bg },
  { name = "shadows", canvas = shadows },
  { name = "enemies", canvas = enemies },
  { name = "party", canvas = party },
  { name = "ui", canvas = hud },
}, { previewScale = 2 })
