-- Fail CI when web or Android rank tables drift from ranks.lua.

local function dirname(path)
  return path:match("(.+)[/\\]") or "."
end

local function join(a, b)
  if a:sub(-1):match("[/\\]") then
    return a .. b
  end
  return a .. "/" .. b
end

local function exists(path)
  local file = io.open(path, "r")
  if not file then
    return false
  end
  file:close()
  return true
end

local function find_root(start)
  local dir = start
  for _ = 1, 8 do
    if exists(join(dir, "lib/ranks.js")) then
      return dir
    end
    local parent = dirname(dir)
    if parent == dir then
      break
    end
    dir = parent
  end
  return "."
end

local script_dir = dirname(arg[0] or ".")
package.path = script_dir .. "/?.lua;" .. package.path

local ranks = require("ranks")
local root = find_root(script_dir)

local function read(rel)
  local path = join(root, rel)
  local file, err = io.open(path, "r")
  if not file then
    error("cannot read " .. path .. ": " .. tostring(err))
  end
  local body = file:read("*a")
  file:close()
  return body
end

local function color_to_kotlin(hex)
  return "0xFF" .. hex:gsub("#", ""):upper()
end

local js = read("lib/ranks.js")
local kt = read("apps/android-native/app/src/main/java/xyz/mathsmine3/nativeapp/ui/theme/RankTiers.kt")

assert(#ranks == 5, "expected 5 rank tiers")

for _, tier in ipairs(ranks) do
  local js_label = "label: '" .. tier.label .. "'"
  if not js:find(js_label, 1, true) then
    error("lib/ranks.js missing " .. js_label)
  end
  local js_range = "min: " .. tier.min .. ", max: " .. tier.max
  if not js:find(js_range, 1, true) then
    error("lib/ranks.js missing " .. js_range)
  end
  if not js:find(tier.color, 1, true) then
    error("lib/ranks.js missing color " .. tier.color)
  end

  local kt_label = '"' .. tier.label .. '"'
  if not kt:find(kt_label, 1, true) then
    error("RankTiers.kt missing " .. kt_label)
  end
  local kt_range = ", " .. tier.min .. ", " .. tier.max .. ")"
  if not kt:find(kt_range, 1, true) then
    error("RankTiers.kt missing range for " .. tier.label)
  end
  local kt_color = color_to_kotlin(tier.color)
  if not kt:find(kt_color, 1, true) then
    error("RankTiers.kt missing " .. kt_color)
  end
end

print("ok  ranks.lua ↔ ranks.js ↔ RankTiers.kt  (" .. #ranks .. " tiers)")
