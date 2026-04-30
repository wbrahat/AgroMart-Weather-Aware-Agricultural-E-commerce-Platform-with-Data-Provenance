from PIL import Image, ImageDraw
from pathlib import Path
import math
import sys


def is_green_border(pixel):
    r, g, b, a = pixel
    return a > 0 and g > 70 and g >= r + 18 and g >= b + 12


def find_inner_circle_radius(image: Image.Image) -> int:
    rgba = image.convert("RGBA")
    width, height = rgba.size
    pixels = rgba.load()
    cx = width / 2.0
    cy = height / 2.0
    max_radius = int(min(width, height) * 0.49)

    samples = 360
    scores = []
    for radius in range(10, max_radius):
        hits = 0
        for step in range(samples):
            angle = (2.0 * math.pi * step) / samples
            x = int(round(cx + math.cos(angle) * radius))
            y = int(round(cy + math.sin(angle) * radius))
            if 0 <= x < width and 0 <= y < height and is_green_border(pixels[x, y]):
                hits += 1
        scores.append((radius, hits / samples))

    best_radius = None
    best_score = 0.0
    for index in range(1, len(scores) - 1):
        radius, score = scores[index]
        if radius < 64:
            continue
        if score >= scores[index - 1][1] and score >= scores[index + 1][1] and score > best_score:
            best_radius = radius
            best_score = score

    if best_radius is None:
        best_radius = int(min(width, height) * 0.28)

    return best_radius


def render_circle_crop(input_path, output_path, diameter=1024, fill_scale=0.82):
    source = Image.open(input_path).convert("RGBA")
    width, height = source.size
    cx = width / 2.0
    cy = height / 2.0

    inner_radius = find_inner_circle_radius(source)
    crop_radius = max(1, inner_radius - 7)

    left = int(round(cx - crop_radius))
    top = int(round(cy - crop_radius))
    right = int(round(cx + crop_radius))
    bottom = int(round(cy + crop_radius))

    cropped = source.crop((left, top, right, bottom))
    target = diameter if diameter > 0 else cropped.size[0]
    badge_size = max(1, int(round(target * fill_scale)))

    if cropped.size != (badge_size, badge_size):
        cropped = cropped.resize((badge_size, badge_size), Image.LANCZOS)

    scale = 4
    mask_size = badge_size * scale
    mask = Image.new("L", (mask_size, mask_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.ellipse((0, 0, mask_size - 1, mask_size - 1), fill=255)
    mask = mask.resize((badge_size, badge_size), Image.LANCZOS)

    out = Image.new("RGBA", (target, target), (0, 0, 0, 0))
    offset = ((target - badge_size) // 2, (target - badge_size) // 2)
    out.paste(cropped, offset, mask)
    out.save(output_path, format="PNG")
    print(f"Saved badge to {Path(output_path).resolve()} using inner radius {inner_radius}")


def make_badge(input_path, output_path, diameter=1024):
    render_circle_crop(input_path, output_path, diameter=diameter)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: python make_badge.py input.png output.png [diameter]")
        sys.exit(1)
    inp = sys.argv[1]
    outp = sys.argv[2]
    diam = int(sys.argv[3]) if len(sys.argv) >=4 else 1024
    make_badge(inp, outp, diameter=diam)
