# frozen_string_literal: true

# Play Console limits + required listing assets for xyz.mathsmine3.app.
# Fastlane (`fastlane verify_listing`) shells out here so CI can run without
# installing the full Fastlane gem.

require "pathname"

ROOT = Pathname.new(__dir__).parent
LISTING = ROOT.join("play-store-listing")
COPY = LISTING.join("listing-copy.md")

TITLE_MAX = 30
SHORT_MAX = 80
FULL_MAX = 4000

RequiredPng = Struct.new(:rel, :width, :height, keyword_init: true)

REQUIRED = [
  RequiredPng.new(rel: "01-app-icon/app-icon-mathsmine3-512x512.png", width: 512, height: 512),
  RequiredPng.new(rel: "02-feature-graphic/feature-graphic-1024x500.png", width: 1024, height: 500),
  RequiredPng.new(rel: "02-feature-graphic/feature-graphic-1024x500-es.png", width: 1024, height: 500),
].freeze

PHONE_DIR = "03-phone-screenshots"
PHONE_SIZE = [1080, 1920].freeze

def png_hw(path)
  File.open(path, "rb") do |file|
    sig = file.read(8)
    raise "#{path} is not a PNG" unless sig == "\x89PNG\r\n\x1A\n".b

    file.read(8) # length + IHDR
    file.read(8).unpack("NN")
  end
end

def section(markdown, heading)
  block = markdown.split(/^## /).find { |part| part.start_with?(heading) }
  raise "listing-copy.md missing ## #{heading}" unless block

  block
end

def field(block, label)
  match = block.match(/^### #{Regexp.escape(label)}\n(.*?)(?=\n### |\z)/m)
  raise "missing #{label}" unless match

  match[1].strip
end

def check_copy
  text = COPY.read
  errors = []
  [
    ["English", "App name", "Short description", "Full description"],
    ["Español", "Nombre de la app", "Descripción breve", "Descripción completa"],
  ].each do |heading, title_label, short_label, full_label|
    block = section(text, heading)
    title = field(block, title_label)
    short = field(block, short_label)
    full = field(block, full_label)
    errors << "#{heading} title #{title.length} > #{TITLE_MAX}" if title.length > TITLE_MAX
    errors << "#{heading} short #{short.length} > #{SHORT_MAX}" if short.length > SHORT_MAX
    errors << "#{heading} full #{full.length} > #{FULL_MAX}" if full.length > FULL_MAX
  end
  errors
end

def check_assets
  errors = []
  REQUIRED.each do |item|
    path = LISTING.join(item.rel)
    unless path.file?
      errors << "missing #{item.rel}"
      next
    end
    width, height = png_hw(path)
    unless width == item.width && height == item.height
      errors << "#{item.rel} is #{width}x#{height}, expected #{item.width}x#{item.height}"
    end
  end
  phones = LISTING.join(PHONE_DIR).glob("*.png")
  errors << "#{PHONE_DIR} needs at least 2 screenshots" if phones.length < 2
  phones.each do |path|
    width, height = png_hw(path)
    unless [width, height] == PHONE_SIZE
      errors << "#{path.relative_path_from(LISTING)} is #{width}x#{height}, expected 1080x1920"
    end
  end
  errors
end

errors = check_copy + check_assets
if errors.empty?
  warn "ok  play listing assets + copy limits"
  exit 0
end

warn "Play listing verification failed:"
errors.each { |line| warn "  - #{line}" }
exit 1
