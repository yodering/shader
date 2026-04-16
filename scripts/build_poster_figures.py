from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "poster-assets"
FILTER_DIR = ASSET_DIR / "filters"
KUWAHARA_DIR = ASSET_DIR / "kuwahara"
SOURCE_IMAGE = ROOT / "public" / "test-images" / "mandril_color.tif"
PIXEL_X = 244
PIXEL_Y = 258
RADIUS = 3


FILTER_LABELS = [
    ("passthrough.png", "Original"),
    ("grayscale.png", "Grayscale"),
    ("box-blur.png", "Box Blur"),
    ("tent-blur.png", "Tent Blur"),
    ("gaussian-blur.png", "Gaussian"),
    ("sobel-edge.png", "Sobel"),
    ("prewitt-edge.png", "Prewitt"),
    ("emboss.png", "Emboss"),
    ("chromatic-aberration.png", "Chromatic"),
    ("fisheye.png", "Fisheye"),
    ("crt.png", "CRT"),
    ("posterize.png", "Posterize"),
]


def load_font(size):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", size)
    except OSError:
        return ImageFont.load_default()


def load_source():
    image = Image.open(SOURCE_IMAGE).convert("RGB")
    return np.asarray(image, dtype=np.float32) / 255.0


def region_stats_for_pixel(image, x=PIXEL_X, y=PIXEL_Y, radius=RADIUS):
    padded = np.pad(image, ((radius, radius), (radius, radius), (0, 0)), mode="edge")
    patch = padded[y : y + 2 * radius + 1, x : x + 2 * radius + 1]
    windows = [
        ("R0", slice(0, radius + 1), slice(0, radius + 1)),
        ("R1", slice(0, radius + 1), slice(radius, 2 * radius + 1)),
        ("R2", slice(radius, 2 * radius + 1), slice(radius, 2 * radius + 1)),
        ("R3", slice(radius, 2 * radius + 1), slice(0, radius + 1)),
    ]

    stats = []
    for name, ys, xs in windows:
        region = patch[ys, xs]
        mean = region.mean(axis=(0, 1))
        variance = np.maximum((region * region).mean(axis=(0, 1)) - mean * mean, 0.0)
        total_variance = float(variance.sum())
        stats.append(
            {
                "name": name,
                "ys": ys,
                "xs": xs,
                "mean": mean,
                "variance": variance,
                "total_variance": total_variance,
            }
        )

    winner = min(stats, key=lambda item: item["total_variance"])
    return patch, stats, winner


def kuwahara_maps(image, radius=3):
    height, width, _ = image.shape
    padded = np.pad(image, ((radius, radius), (radius, radius), (0, 0)), mode="edge")

    variances = np.zeros((height, width, 4), dtype=np.float32)
    result = np.zeros((height, width, 3), dtype=np.float32)

    windows = [
        (slice(0, radius + 1), slice(0, radius + 1)),
        (slice(0, radius + 1), slice(radius, 2 * radius + 1)),
        (slice(radius, 2 * radius + 1), slice(radius, 2 * radius + 1)),
        (slice(radius, 2 * radius + 1), slice(0, radius + 1)),
    ]

    for y in range(height):
        for x in range(width):
            patch = padded[y : y + 2 * radius + 1, x : x + 2 * radius + 1]
            best_variance = None
            best_mean = None

            for idx, (ys, xs) in enumerate(windows):
                region = patch[ys, xs]
                mean = region.mean(axis=(0, 1))
                variance = np.maximum((region * region).mean(axis=(0, 1)) - mean * mean, 0.0)
                total_variance = float(variance.sum())
                variances[y, x, idx] = total_variance

                if best_variance is None or total_variance < best_variance:
                    best_variance = total_variance
                    best_mean = mean

            result[y, x] = best_mean

    return variances, result


def save_region_overlay():
    cell = 34
    grid_size = 7
    panel_size = grid_size * cell
    margin = 20
    label_gap = 10
    label_h = 28
    width = 2 * panel_size + 3 * margin
    height = 2 * panel_size + 3 * margin + 2 * label_h + 2 * label_gap
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    font = load_font(20)
    left = PIXEL_X - RADIUS
    upper = PIXEL_Y - RADIUS
    right = PIXEL_X + RADIUS + 1
    lower = PIXEL_Y + RADIUS + 1
    patch = Image.open(SOURCE_IMAGE).convert("RGB").crop((left, upper, right, lower)).resize((panel_size, panel_size), Image.Resampling.NEAREST)

    colors = {
        "R0": (126, 200, 88),
        "R1": (241, 196, 15),
        "R2": (52, 152, 219),
        "R3": (231, 76, 60),
    }
    offsets = {
        "R0": (margin, margin),
        "R1": (2 * margin + panel_size, margin),
        "R3": (margin, 2 * margin + panel_size + label_h + label_gap),
        "R2": (2 * margin + panel_size, 2 * margin + panel_size + label_h + label_gap),
    }
    masks = {
        "R0": (0, 0, 4, 4),
        "R1": (3, 0, 7, 4),
        "R2": (3, 3, 7, 7),
        "R3": (0, 3, 4, 7),
    }

    for label, (x0, y0) in offsets.items():
        panel = patch.copy()
        xs, ys, xe, ye = masks[label]
        image.paste(panel, (x0, y0))

        for i in range(grid_size + 1):
            pos = i * cell
            draw.line((x0 + pos, y0, x0 + pos, y0 + panel_size), fill=(220, 220, 220), width=1)
            draw.line((x0, y0 + pos, x0 + panel_size, y0 + pos), fill=(220, 220, 220), width=1)

        draw.rectangle((x0, y0, x0 + panel_size, y0 + panel_size), outline=(40, 40, 40), width=2)
        draw.rectangle(
            (x0 + xs * cell, y0 + ys * cell, x0 + xe * cell, y0 + ye * cell),
            outline=colors[label],
            width=5,
        )
        cx = x0 + RADIUS * cell
        cy = y0 + RADIUS * cell
        draw.rectangle((cx, cy, cx + cell, cy + cell), outline=(255, 80, 80), width=4)
        text_box = draw.textbbox((0, 0), label, font=font)
        tx = x0 + (panel_size - (text_box[2] - text_box[0])) // 2
        ty = y0 + panel_size + label_gap
        draw.text((tx, ty), label, fill=(20, 20, 20), font=font)

    image.save(KUWAHARA_DIR / "kuwahara-region-overlay.png")


def save_patch_locator():
    image = Image.open(SOURCE_IMAGE).convert("RGB")
    scale = 2
    width, height = image.size
    canvas = image.resize((width * scale, height * scale), Image.Resampling.NEAREST)
    draw = ImageDraw.Draw(canvas)
    font = load_font(24)

    left = (PIXEL_X - RADIUS) * scale
    upper = (PIXEL_Y - RADIUS) * scale
    right = (PIXEL_X + RADIUS + 1) * scale
    lower = (PIXEL_Y + RADIUS + 1) * scale
    center_x = int((PIXEL_X + 0.5) * scale)
    center_y = int((PIXEL_Y + 0.5) * scale)

    draw.rectangle((left, upper, right, lower), outline=(122, 78, 255), width=5)
    draw.ellipse((center_x - 7, center_y - 7, center_x + 7, center_y + 7), fill=(255, 255, 255), outline=(122, 78, 255), width=3)

    label = "Selected 7x7 neighborhood"
    text_box = draw.textbbox((0, 0), label, font=font)
    label_w = text_box[2] - text_box[0]
    label_h = text_box[3] - text_box[1]
    label_x = min(max(left - 20, 12), canvas.size[0] - label_w - 20)
    label_y = max(12, upper - label_h - 20)
    draw.rounded_rectangle((label_x - 10, label_y - 8, label_x + label_w + 10, label_y + label_h + 8), radius=10, fill=(255, 255, 255), outline=(122, 78, 255), width=3)
    draw.text((label_x, label_y), label, fill=(20, 20, 20), font=font)
    draw.line((label_x + label_w // 2, label_y + label_h + 8, center_x, center_y - 10), fill=(122, 78, 255), width=4)

    canvas.save(KUWAHARA_DIR / "kuwahara-patch-locator.png")


def save_selection_panel(image):
    patch, _, winner = region_stats_for_pixel(image)
    scale = 34
    patch_img = Image.fromarray((patch * 255).astype(np.uint8), mode="RGB").resize((238, 238), Image.Resampling.NEAREST)
    panel = Image.new("RGB", (420, 420), "white")
    panel.paste(patch_img, (26, 96))
    draw = ImageDraw.Draw(panel)

    rect_lookup = {
        "R0": (0, 0, 4, 4),
        "R1": (3, 0, 7, 4),
        "R2": (3, 3, 7, 7),
        "R3": (0, 3, 4, 7),
    }

    x0, y0, x1, y1 = rect_lookup[winner["name"]]
    draw.rectangle(
        (26 + x0 * scale, 96 + y0 * scale, 26 + x1 * scale, 96 + y1 * scale),
        outline=(122, 78, 255),
        width=6,
    )

    swatch = tuple(int(channel * 255) for channel in winner["mean"])
    arrow_y = 215
    arrow_start = 280
    arrow_end = 330
    draw.line((arrow_start, arrow_y, arrow_end, arrow_y), fill=(122, 78, 255), width=6)
    draw.polygon(
        [(arrow_end, arrow_y), (arrow_end - 16, arrow_y - 12), (arrow_end - 16, arrow_y + 12)],
        fill=(122, 78, 255),
    )

    swatch_size = 60
    swatch_x = 350
    swatch_y = arrow_y - (swatch_size // 2)
    draw.rounded_rectangle(
        (swatch_x, swatch_y, swatch_x + swatch_size, swatch_y + swatch_size),
        radius=12,
        fill=swatch,
        outline=(40, 40, 40),
        width=2,
    )
    panel.save(KUWAHARA_DIR / "kuwahara-selection.png")


def build_filter_contact_sheet():
    card_w = 320
    card_h = 390
    cols = 4
    rows = 3
    margin = 28
    sheet = Image.new("RGB", (cols * card_w + (cols + 1) * margin, rows * card_h + (rows + 1) * margin), "white")
    font = load_font(24)

    for idx, (filename, label) in enumerate(FILTER_LABELS):
        image = Image.open(FILTER_DIR / filename).convert("RGB").resize((card_w, card_w), Image.Resampling.LANCZOS)
        x = margin + (idx % cols) * (card_w + margin)
        y = margin + (idx // cols) * (card_h + margin)
        sheet.paste(image, (x, y))

        draw = ImageDraw.Draw(sheet)
        bbox = draw.textbbox((0, 0), label, font=font)
        tx = x + (card_w - (bbox[2] - bbox[0])) // 2
        ty = y + card_w + 12
        draw.text((tx, ty), label, fill=(20, 20, 20), font=font)

    sheet.save(ASSET_DIR / "filter-grid.png")


def load_rgb_image(path):
    return np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)


def find_difference_points(images, count=3, crop_size=72, min_dist=110):
    names = list(images.keys())
    arrays = [images[name] for name in names]
    score = np.zeros(arrays[0].shape[:2], dtype=np.float32)

    for i in range(len(arrays)):
        for j in range(i + 1, len(arrays)):
            diff = np.abs(arrays[i] - arrays[j]).mean(axis=2)
            score += diff

    half = crop_size // 2
    score[:half, :] = -1
    score[-half:, :] = -1
    score[:, :half] = -1
    score[:, -half:] = -1

    points = []
    for _ in range(count):
        y, x = np.unravel_index(np.argmax(score), score.shape)
        if score[y, x] < 0:
            break
        points.append((int(x), int(y)))

        yy, xx = np.ogrid[: score.shape[0], : score.shape[1]]
        mask = (xx - x) ** 2 + (yy - y) ** 2 <= min_dist ** 2
        score[mask] = -1

    return points


def save_filter_difference_assets():
    images = {
        "Kuwahara": load_rgb_image(KUWAHARA_DIR / "kuwahara-final.png"),
        "Tomita-Tsuji": load_rgb_image(KUWAHARA_DIR / "tomita-final.png"),
        "Nagao-Matsuyama": load_rgb_image(KUWAHARA_DIR / "nagao-final.png"),
    }
    pil_images = {name: Image.fromarray(arr.astype(np.uint8), mode="RGB") for name, arr in images.items()}
    points = find_difference_points(images)

    colors = [(122, 78, 255), (255, 99, 71), (0, 166, 118)]
    crop_size = 72
    zoom_size = 220
    full_size = 220
    gap = 22
    title_h = 34
    label_h = 26
    row_gap = 26
    margin = 18
    font = load_font(20)
    small_font = load_font(18)

    # Full comparison row with circles.
    full_canvas_w = margin * 4 + full_size * 3
    full_canvas_h = margin * 2 + title_h + full_size + label_h
    full_canvas = Image.new("RGB", (full_canvas_w, full_canvas_h), "white")
    full_draw = ImageDraw.Draw(full_canvas)

    for idx, (name, img) in enumerate(pil_images.items()):
        thumb = img.resize((full_size, full_size), Image.Resampling.LANCZOS)
        x = margin + idx * (full_size + margin)
        y = margin + title_h
        full_canvas.paste(thumb, (x, y))

        scale = full_size / img.size[0]
        for n, (px, py) in enumerate(points):
            cx = x + px * scale
            cy = y + py * scale
            r = crop_size * scale * 0.42
            full_draw.ellipse((cx - r, cy - r, cx + r, cy + r), outline=colors[n], width=4)
            full_draw.text((cx + r + 4, cy - 14), str(n + 1), fill=colors[n], font=font)

        title_box = full_draw.textbbox((0, 0), name, font=font)
        tx = x + (full_size - (title_box[2] - title_box[0])) // 2
        full_draw.text((tx, margin), name, fill=(20, 20, 20), font=font)

    full_canvas.save(ASSET_DIR / "kuwahara-comparison-full.png")

    # Zoom crop sheet.
    names = list(pil_images.keys())
    zoom_canvas_w = margin * 4 + zoom_size * 3
    zoom_canvas_h = margin * (len(points) + 1) + len(points) * (title_h + zoom_size + label_h)
    zoom_canvas = Image.new("RGB", (zoom_canvas_w, zoom_canvas_h), "white")
    zoom_draw = ImageDraw.Draw(zoom_canvas)

    for row, (px, py) in enumerate(points):
        row_y = margin + row * (margin + title_h + zoom_size + label_h)
        zoom_draw.text((margin, row_y), f"Detail {row + 1}", fill=colors[row], font=font)

        for col, name in enumerate(names):
            img = pil_images[name]
            left = px - crop_size // 2
            top = py - crop_size // 2
            crop = img.crop((left, top, left + crop_size, top + crop_size)).resize((zoom_size, zoom_size), Image.Resampling.NEAREST)
            x = margin + col * (zoom_size + margin)
            y = row_y + title_h
            zoom_canvas.paste(crop, (x, y))
            zoom_draw.rectangle((x, y, x + zoom_size, y + zoom_size), outline=colors[row], width=3)

            title_box = zoom_draw.textbbox((0, 0), name, font=small_font)
            tx = x + (zoom_size - (title_box[2] - title_box[0])) // 2
            zoom_draw.text((tx, y + zoom_size + 6), name, fill=(20, 20, 20), font=small_font)

    zoom_canvas.save(ASSET_DIR / "kuwahara-comparison-zooms.png")
def main():
    if not FILTER_DIR.exists():
        raise SystemExit("Run the export step first so poster-assets/filters exists.")

    image = load_source()
    _, _ = kuwahara_maps(image, radius=3)
    save_patch_locator()
    save_region_overlay()
    save_selection_panel(image)
    build_filter_contact_sheet()
    save_filter_difference_assets()


if __name__ == "__main__":
    main()
