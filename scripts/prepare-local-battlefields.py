"""Create local-only annotation-free battlefield development assets.

This script deliberately uses rectangular, neutral-pixel masks. It never
inpaints or reconstructs map geometry. When an annotation overlaps structural
art, the clean derivative contains a documented neutral gap and the untouched
source remains the fidelity reference.

The source and output directories are Git-ignored because redistribution
permission for the Kimber Prime artwork has not been confirmed.
"""

from __future__ import annotations

from collections import deque
from dataclasses import dataclass
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT: Final = Path(__file__).resolve().parents[1]
SOURCE_DIR: Final = ROOT / "src/assets/battlefields/local-source"
OUTPUT_DIR: Final = ROOT / "src/assets/battlefields/local-clean"
DETECTION_WIDTH: Final = 1179


@dataclass(frozen=True)
class AssetPlan:
    source_name: str
    output_name: str
    dimensions: tuple[int, int]
    broad_masks: tuple[tuple[int, int, int, int], ...]
    text_masks: tuple[tuple[int, int, int, int], ...] = ()


# All rectangles are source-pixel coordinates and cover only non-structural
# title, legend, attribution, website, button, or small label regions. Embedded
# collectible icons are located below with deterministic color-component
# detection and replaced by neutral gaps rather than guessed geometry.
PLANS: Final = (
    AssetPlan(
        "ballistic engine.png",
        "ballistic-engine.png",
        (1179, 1542),
        ((790, 0, 1179, 245), (500, 420, 1179, 590), (25, 1300, 335, 1542)),
    ),
    AssetPlan(
        "decapitaion.png",
        "decapitation.png",
        (1179, 1631),
        ((20, 5, 365, 280), (30, 770, 655, 950), (885, 1375, 1179, 1631)),
        ((965, 895, 1145, 930), (965, 1090, 1145, 1128)),
    ),
    AssetPlan(
        "disruption.png",
        "disruption.png",
        (1179, 1846),
        ((135, 0, 505, 265), (325, 865, 770, 1030), (40, 1600, 340, 1846)),
    ),
    AssetPlan(
        "exfiltration.png",
        "exfiltration.png",
        (1179, 2556),
        ((650, 170, 1179, 410), (390, 985, 1010, 1155), (825, 2080, 1179, 2300)),
    ),
    AssetPlan(
        "fall of atreus.png",
        "fall-of-atreus.png",
        (1179, 1225),
        ((215, 350, 690, 485), (30, 535, 365, 830), (850, 945, 1179, 1225)),
        ((55, 1060, 135, 1095), (270, 1070, 365, 1105), (605, 1135, 720, 1175)),
    ),
    AssetPlan(
        "inferno.png",
        "inferno.png",
        (1179, 1533),
        ((805, 0, 1179, 285), (725, 665, 1179, 825), (35, 835, 350, 1095)),
        ((540, 1150, 655, 1200),),
    ),
    AssetPlan(
        "obelisk.png",
        "obelisk.png",
        (1179, 1652),
        ((85, 45, 440, 275), (345, 975, 805, 1145), (35, 1410, 345, 1652)),
        (
            (620, 145, 785, 220),
            (275, 570, 355, 610),
            (165, 645, 260, 690),
            (155, 700, 270, 750),
            (260, 740, 390, 800),
        ),
    ),
    AssetPlan(
        "purgation.png",
        "purgation.png",
        (3990, 5000),
        ((0, 0, 980, 250), (2330, 390, 3990, 900), (2760, 4200, 3990, 5000)),
        ((1650, 3950, 2200, 4120), (1690, 4450, 2250, 4620)),
    ),
    AssetPlan(
        "reclaimation.png",
        "reclamation.png",
        (1179, 1414),
        ((790, 20, 1179, 320), (25, 900, 650, 1090), (880, 1170, 1179, 1414)),
        ((45, 1200, 220, 1285),),
    ),
    AssetPlan(
        "reliquary.png",
        "reliquary.png",
        (1179, 1573),
        ((15, 0, 370, 285), (380, 1280, 845, 1445), (25, 1280, 360, 1573)),
        (
            (540, 545, 610, 590),
            (490, 840, 555, 885),
            (645, 680, 705, 725),
            (650, 525, 710, 575),
            (570, 725, 630, 775),
        ),
    ),
    AssetPlan(
        "termination.png",
        "termination.png",
        (1179, 1546),
        ((830, 0, 1179, 240), (35, 1095, 650, 1285), (15, 1305, 345, 1546)),
    ),
    AssetPlan(
        "vortex.png",
        "vortex.png",
        (1179, 1294),
        ((20, 0, 365, 250), (65, 535, 540, 715), (15, 1060, 345, 1294), (430, 1180, 800, 1285)),
        ((620, 35, 845, 145),),
    ),
    AssetPlan(
        "vox liberatis.png",
        "vox-liberatis.png",
        (1179, 1545),
        ((710, 0, 1179, 285), (350, 770, 850, 940), (30, 1260, 365, 1545)),
        (
            (760, 295, 920, 335),
            (990, 330, 1165, 375),
            (610, 720, 730, 765),
            (760, 710, 880, 760),
            (985, 735, 1110, 785),
            (980, 900, 1115, 950),
        ),
    ),
)


@dataclass(frozen=True)
class ColorRule:
    name: str
    hue_ranges: tuple[tuple[int, int], ...]
    minimum_saturation: int
    minimum_value: int
    minimum_width: int
    minimum_height: int
    maximum_width: int
    maximum_height: int
    padding: int


COLOR_RULES: Final = (
    ColorRule("green", ((48, 112),), 105, 55, 9, 9, 80, 80, 9),
    ColorRule("orange", ((5, 34),), 100, 90, 8, 8, 90, 80, 9),
    ColorRule("red", ((0, 8), (245, 255)), 45, 35, 13, 13, 85, 85, 10),
    ColorRule("blue", ((135, 185),), 75, 50, 5, 6, 60, 70, 8),
    ColorRule("cyan", ((108, 150),), 35, 65, 5, 4, 65, 60, 9),
    ColorRule("gold", ((22, 50),), 45, 45, 12, 12, 85, 85, 12),
)


def overlaps(rect: tuple[int, int, int, int], other: tuple[int, int, int, int]) -> bool:
    left, top, right, bottom = rect
    o_left, o_top, o_right, o_bottom = other
    return left < o_right and right > o_left and top < o_bottom and bottom > o_top


def connected_components(mask: np.ndarray) -> list[tuple[int, int, int, int]]:
    height, width = mask.shape
    seen = np.zeros(mask.shape, dtype=np.bool_)
    components: list[tuple[int, int, int, int]] = []
    starts_y, starts_x = np.nonzero(mask)

    for start_y, start_x in zip(starts_y.tolist(), starts_x.tolist(), strict=True):
        if seen[start_y, start_x]:
            continue

        queue: deque[tuple[int, int]] = deque([(start_x, start_y)])
        seen[start_y, start_x] = True
        min_x = max_x = start_x
        min_y = max_y = start_y

        while queue:
            x, y = queue.popleft()
            min_x = min(min_x, x)
            max_x = max(max_x, x)
            min_y = min(min_y, y)
            max_y = max(max_y, y)

            for next_y in range(max(0, y - 1), min(height, y + 2)):
                for next_x in range(max(0, x - 1), min(width, x + 2)):
                    if mask[next_y, next_x] and not seen[next_y, next_x]:
                        seen[next_y, next_x] = True
                        queue.append((next_x, next_y))

        components.append((min_x, min_y, max_x + 1, max_y + 1))

    return components


def locate_colored_annotations(
    image: Image.Image,
    broad_masks: tuple[tuple[int, int, int, int], ...],
) -> list[tuple[str, tuple[int, int, int, int]]]:
    scale = min(1.0, DETECTION_WIDTH / image.width)
    detection_size = (
        round(image.width * scale),
        round(image.height * scale),
    )
    detection_image = image.resize(detection_size, Image.Resampling.LANCZOS)
    hsv = np.asarray(detection_image.convert("HSV"))
    hue = hsv[:, :, 0]
    saturation = hsv[:, :, 1]
    value = hsv[:, :, 2]
    found: list[tuple[str, tuple[int, int, int, int]]] = []

    for rule in COLOR_RULES:
        hue_mask = np.zeros(hue.shape, dtype=np.bool_)
        for minimum_hue, maximum_hue in rule.hue_ranges:
            hue_mask |= (hue >= minimum_hue) & (hue <= maximum_hue)

        raw_mask = hue_mask & (saturation >= rule.minimum_saturation) & (value >= rule.minimum_value)
        dilated = Image.fromarray(raw_mask.astype(np.uint8) * 255).filter(
            ImageFilter.MaxFilter(7),
        )
        components = connected_components(np.asarray(dilated) > 0)

        for left, top, right, bottom in components:
            component_width = right - left
            component_height = bottom - top
            if not (
                rule.minimum_width <= component_width <= rule.maximum_width
                and rule.minimum_height <= component_height <= rule.maximum_height
            ):
                continue

            pad = rule.padding
            scaled_rect = (
                max(0, round((left - pad) / scale)),
                max(0, round((top - pad) / scale)),
                min(image.width, round((right + pad) / scale)),
                min(image.height, round((bottom + pad) / scale)),
            )
            if any(overlaps(scaled_rect, broad_mask) for broad_mask in broad_masks):
                continue
            found.append((rule.name, scaled_rect))

    return found


def merge_rectangles(
    entries: list[tuple[str, tuple[int, int, int, int]]],
) -> list[tuple[str, tuple[int, int, int, int]]]:
    merged: list[tuple[set[str], tuple[int, int, int, int]]] = []

    for label, rect in entries:
        labels = {label}
        changed = True
        while changed:
            changed = False
            remaining: list[tuple[set[str], tuple[int, int, int, int]]] = []
            for existing_labels, existing_rect in merged:
                if overlaps(rect, existing_rect):
                    labels.update(existing_labels)
                    rect = (
                        min(rect[0], existing_rect[0]),
                        min(rect[1], existing_rect[1]),
                        max(rect[2], existing_rect[2]),
                        max(rect[3], existing_rect[3]),
                    )
                    changed = True
                else:
                    remaining.append((existing_labels, existing_rect))
            merged = remaining
        merged.append((labels, rect))

    return [("+".join(sorted(labels)), rect) for labels, rect in merged]


def neutral_color(image: Image.Image, rect: tuple[int, int, int, int]) -> tuple[int, int, int]:
    left, top, right, bottom = rect
    pad = max(8, round(min(image.width, image.height) * 0.006))
    ring = np.asarray(
        image.crop(
            (
                max(0, left - pad),
                max(0, top - pad),
                min(image.width, right + pad),
                min(image.height, bottom + pad),
            ),
        ).convert("RGB"),
    ).reshape(-1, 3)
    maximum = ring.max(axis=1)
    minimum = ring.min(axis=1)
    neutral = ring[(maximum < 110) & ((maximum - minimum) < 24)]
    if len(neutral) == 0:
        neutral = ring[maximum < 130]
    if len(neutral) == 0:
        return (30, 30, 30)
    median = np.median(neutral, axis=0).astype(np.uint8)
    return int(median[0]), int(median[1]), int(median[2])


def process(plan: AssetPlan) -> list[str]:
    source_path = SOURCE_DIR / plan.source_name
    output_path = OUTPUT_DIR / plan.output_name
    with Image.open(source_path) as opened:
        image = opened.convert("RGB")

    if image.size != plan.dimensions:
        raise ValueError(
            f"{plan.source_name}: expected {plan.dimensions}, got {image.size}",
        )

    fixed_masks = plan.broad_masks + plan.text_masks
    colored_masks = merge_rectangles(
        locate_colored_annotations(image, plan.broad_masks),
    )
    draw = ImageDraw.Draw(image)
    report: list[str] = []

    for label, rect in (
        [("broad annotation block", rect) for rect in plan.broad_masks]
        + [("text label", rect) for rect in plan.text_masks]
        + colored_masks
    ):
        draw.rectangle(rect, fill=neutral_color(image, rect))
        report.append(f"- `{label}`: `{rect}`")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, format="PNG", compress_level=9)
    return report


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    report_lines = [
        "# Local battlefield masking report",
        "",
        "Generated deterministically by `scripts/prepare-local-battlefields.py`.",
        "Every embedded-annotation mask is a neutral gap, not reconstructed geometry.",
        "",
    ]

    for plan in PLANS:
        report_lines.extend((f"## {plan.output_name}", ""))
        report_lines.extend(process(plan))
        report_lines.append("")

    (OUTPUT_DIR / "MASK_REPORT.md").write_text(
        "\n".join(report_lines),
        encoding="utf-8",
    )
    print(f"Prepared {len(PLANS)} local battlefield assets in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
