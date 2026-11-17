-- Asset 4: UI kit sheet, 270 x 172. Every widget of the battle screen,
-- laid out with labels. Each widget is also a named slice in the
-- .aseprite file. Needs the warrior and monster exports (for portraits).

local core = dofile("lib/core.lua")
local ui = dofile("lib/ui.lua")(core)
local C, font = core.C, ui.font

local W, H = 270, 172
local back = core.canvas(W, H)     -- plain dark backdrop
local kit = core.canvas(W, H)      -- the widgets
local labels = core.canvas(W, H)   -- names of the groups
for i = 0, W * H - 1 do back.col[i] = C.ink end

local slices = {}
local function slice(name, x, y, w, h, center)
  slices[#slices + 1] = { name = name, x = x, y = y, w = w, h = h, center = center }
end
local function label(x, y, text)
  font.draw(labels, x, y, text, C.slate)
end

-- Turn bar and speed buttons -----------------------------------------------------
label(6, 3, "TURN BAR")
ui.turnBar(kit, 6, 11, { "ally", "enemy", "enemy", "ally" }, 1)
slice("turn_bar", 6, 11, ui.TURNBAR_W, ui.TURNBAR_H)

label(174, 3, "SPEED")
for n = 1, 3 do
  local x = 174 + (n - 1) * 31
  ui.speed(kit, x, 11, n, n == 2)
  slice("speed_" .. n .. "x", x, 11, ui.SPEED_W, ui.SPEED_H)
end

-- Skill buttons ------------------------------------------------------------------
label(6, 42, "SKILLS: SELECTED, NORMAL, NORMAL, COOLDOWN")
local skills = {
  { icon = "slash", name = "SLASH", cost = "+10" },
  { icon = "cleave", name = "CLEAVE", cost = "30" },
  { icon = "guard", name = "GUARD", cost = "10" },
  { icon = "warcry", name = "WARCRY", cost = "50", cooldown = 2 },
}
local states = { "selected", "normal", "normal", "cooldown" }
for i, s in ipairs(skills) do
  local x = 6 + (i - 1) * 64
  ui.skill(kit, x, 50, s, states[i])
  slice("skill_" .. s.icon, x, 50, ui.SKILL_W, ui.SKILL_H)
end

-- Bars ---------------------------------------------------------------------------
label(6, 101, "HP BAR")
ui.statBar(kit, 6, 109, "hp", 84, 120, 90)
slice("hp_bar", 16, 109, 90, ui.BAR_H)
label(140, 101, "RAGE BAR")
ui.statBar(kit, 140, 109, "rage", 60, 100, 90)
slice("rage_bar", 150, 109, 90, ui.BAR_H)

-- Consumables, panel, markers ------------------------------------------------------
label(6, 124, "ITEMS")
local items = { { "potion_red", 3 }, { "potion_blue", 1 }, { "bomb", 2 } }
for i, it in ipairs(items) do
  local x = 6 + (i - 1) * 26
  ui.slot(kit, x, 132, it[1], it[2])
  slice("slot_" .. it[1], x, 132, ui.SLOT, ui.SLOT)
end

label(96, 124, "9-SLICE")
kit:blit(ui.tile("panel"), 96, 132)
slice("panel", 96, 132, ui.TILE, ui.TILE,
  { ui.INSET, ui.INSET, ui.TILE - 2 * ui.INSET, ui.TILE - 2 * ui.INSET })
ui.panel(kit, 134, 132, 58, 32, "panel")
font.centre(kit, 163, 146, "PANEL", C.cream, C.ink)

label(204, 124, "MARKERS")
ui.marker(kit, 204, 132, "ally", false)
slice("marker_ally", 204, 132, ui.MARKER, ui.MARKER)
ui.marker(kit, 230, 132, "enemy", false)
slice("marker_enemy", 230, 132, ui.MARKER, ui.MARKER)

core.export("ui_kit", {
  { name = "backdrop", canvas = back },
  { name = "widgets", canvas = kit },
  { name = "labels", canvas = labels },
}, { slices = slices, previewScale = 3 })
