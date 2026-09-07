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
from hashlib import sha256
from pathlib import Path
from typing import Final

import numpy as np
from PIL import Image, ImageDraw, ImageFilter


ROOT: Final = Path(__file__).resolve().parents[1]
SOURCE_DIR: Final = ROOT / "src/assets/battlefields/local-source"
OUTPUT_DIR: Final = ROOT / "src/assets/battlefields/local-clean"
DETECTION_WIDTH: Final = 1179


def guide_mask(
    x: int,
    y: int,
    horizontal_radius: int = 42,
    vertical_radius: int = 42,
) -> tuple[int, int, int, int]:
    """Return a small, source-pixel neutral gap centered on one guide symbol."""
    return (x - horizontal_radius, y - vertical_radius, x + horizontal_radius, y + vertical_radius)


@dataclass(frozen=True)
class AssetPlan:
    source_name: str
    output_name: str
    dimensions: tuple[int, int]
    broad_masks: tuple[tuple[int, int, int, int], ...]
    text_masks: tuple[tuple[int, int, int, int], ...] = ()
    guide_masks: tuple[tuple[int, int, int, int], ...] = ()
    detect_colored_annotations: bool = True
    preserve_existing_output: bool = False


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
        ((135, 0, 505, 250), (335, 875, 765, 1015), (40, 1600, 340, 1846)),
        guide_masks=(
            guide_mask(805, 190), guide_mask(850, 65), guide_mask(930, 520),
            guide_mask(835, 650), guide_mask(250, 710), guide_mask(280, 735),
            guide_mask(510, 800), guide_mask(140, 990), guide_mask(790, 960),
            guide_mask(950, 930), guide_mask(845, 1110), guide_mask(225, 1130),
            guide_mask(280, 1150), guide_mask(430, 1190), guide_mask(370, 1240),
            guide_mask(470, 1290), guide_mask(480, 1320), guide_mask(800, 1320),
            guide_mask(720, 1400), guide_mask(740, 1430), guide_mask(450, 1490),
            guide_mask(710, 1450), guide_mask(700, 1510), guide_mask(850, 1730),
        ),
        detect_colored_annotations=False,
        preserve_existing_output=True,
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
        ((815, 0, 1179, 285), (735, 690, 1179, 830), (35, 835, 335, 1095)),
        ((540, 1150, 655, 1200),),
        (
            guide_mask(160, 105), guide_mask(195, 85), guide_mask(245, 85),
            guide_mask(400, 105), guide_mask(430, 150), guide_mask(705, 160),
            guide_mask(100, 265), guide_mask(285, 240), guide_mask(310, 240),
            guide_mask(85, 310), guide_mask(190, 330), guide_mask(155, 470),
            guide_mask(280, 440), guide_mask(400, 430), guide_mask(565, 400),
            guide_mask(580, 480), guide_mask(845, 390), guide_mask(565, 550),
            guide_mask(790, 450), guide_mask(790, 555), guide_mask(845, 550),
            guide_mask(700, 650), guide_mask(450, 875), guide_mask(560, 900),
            guide_mask(745, 900), guide_mask(880, 930), guide_mask(915, 935),
            guide_mask(1080, 1025), guide_mask(1080, 1070), guide_mask(445, 1140),
            guide_mask(590, 1165), guide_mask(500, 1270), guide_mask(530, 1280),
            guide_mask(310, 1320), guide_mask(510, 1320), guide_mask(720, 1350),
            guide_mask(285, 1380), guide_mask(800, 1340), guide_mask(920, 1410),
            guide_mask(875, 1450),
        ),
        False,
        preserve_existing_output=True,
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
        ((810, 20, 1179, 285), (45, 930, 650, 1080), (880, 1210, 1179, 1414)),
        ((45, 1200, 220, 1285),),
        (
            guide_mask(215, 85), guide_mask(260, 145), guide_mask(215, 165),
            guide_mask(445, 360), guide_mask(370, 420), guide_mask(410, 430),
            guide_mask(480, 430), guide_mask(525, 440), guide_mask(365, 520),
            guide_mask(310, 575), guide_mask(590, 560), guide_mask(590, 650),
            guide_mask(280, 790), guide_mask(270, 850), guide_mask(535, 900),
            guide_mask(810, 750), guide_mask(1020, 890), guide_mask(820, 980),
            guide_mask(1010, 970), guide_mask(985, 990), guide_mask(875, 1030),
            guide_mask(590, 1050), guide_mask(660, 1100), guide_mask(730, 1080),
            guide_mask(530, 1110), guide_mask(660, 1190), guide_mask(385, 1310),
            guide_mask(535, 1310),
        ),
        False,
        preserve_existing_output=True,
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
        ((850, 0, 1179, 235), (45, 1125, 600, 1260), (15, 1285, 345, 1546)),
        detect_colored_annotations=False,
        preserve_existing_output=True,
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
        ((710, 0, 1179, 285), (350, 780, 850, 920), (30, 1260, 365, 1545)),
        (
            (760, 295, 920, 335),
            (990, 330, 1165, 375),
            (610, 720, 730, 765),
            (760, 710, 880, 760),
            (985, 735, 1110, 785),
            (980, 900, 1115, 950),
        ),
        (
            guide_mask(180, 90), guide_mask(160, 115), guide_mask(280, 165),
            guide_mask(365, 65), guide_mask(130, 235), guide_mask(480, 250),
            guide_mask(550, 270), guide_mask(430, 320), guide_mask(780, 300, 55, 24),
            guide_mask(1030, 340, 55, 24), guide_mask(110, 375), guide_mask(550, 360),
            guide_mask(160, 420), guide_mask(75, 535), guide_mask(600, 570),
            guide_mask(110, 585), guide_mask(850, 620), guide_mask(675, 630),
            guide_mask(860, 650), guide_mask(700, 710), guide_mask(600, 715),
            guide_mask(645, 705), guide_mask(820, 705), guide_mask(1050, 675),
            guide_mask(1050, 705), guide_mask(630, 735, 60, 24),
            guide_mask(805, 735, 60, 24), guide_mask(1000, 780, 60, 24),
            guide_mask(1000, 950, 60, 24), guide_mask(210, 790), guide_mask(230, 880),
            guide_mask(365, 950), guide_mask(710, 990), guide_mask(1050, 930),
            guide_mask(215, 1175), guide_mask(270, 1190), guide_mask(580, 1150),
            guide_mask(1050, 1100), guide_mask(1030, 1450, 55, 28),
        ),
        False,
        preserve_existing_output=True,
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
    # Marker icons are compact, high-saturation shapes. Structural path and
    # door lines are deliberately too narrow to match these bounds.
    ColorRule("green", ((48, 112),), 105, 55, 45, 45, 80, 80, 9),
    ColorRule("orange", ((5, 34),), 110, 100, 48, 48, 90, 80, 9),
    ColorRule("red", ((0, 8), (245, 255)), 70, 45, 58, 58, 90, 90, 10),
    ColorRule("gold", ((22, 50),), 75, 65, 62, 62, 90, 90, 12),
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


def neutral_color(image: Image.Image, rect: tuple[int, int, int, int]) -> tuple[int, int, int]:
    # A constant canvas-background gap is deliberately more honest than an
    # inferred fill where a guide symbol covers unknown structural detail.
    # These schematics share the same near-black canvas background.
    return (28, 28, 28)


def _legacy_neutral_color(image: Image.Image, rect: tuple[int, int, int, int]) -> tuple[int, int, int]:
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
    if plan.preserve_existing_output:
        raise ValueError(f"{plan.output_name} is a reviewed local-only restoration")

    source_path = SOURCE_DIR / plan.source_name
    output_path = OUTPUT_DIR / plan.output_name
    with Image.open(source_path) as opened:
        image = opened.convert("RGB")

    if image.size != plan.dimensions:
        raise ValueError(
            f"{plan.source_name}: expected {plan.dimensions}, got {image.size}",
        )

    # The five reviewed maps use explicit, compact masks because their colored
    # structural paths are visually similar to guide-marker colors. The legacy
    # detector remains available for the unreviewed local derivatives.
    colored_masks = (
        locate_colored_annotations(image, plan.broad_masks)
        if plan.detect_colored_annotations
        else []
    )
    draw = ImageDraw.Draw(image)
    report: list[str] = []

    for label, rect in (
        [("broad annotation block", rect) for rect in plan.broad_masks]
        + [("text label", rect) for rect in plan.text_masks]
        + [("guide symbol", rect) for rect in plan.guide_masks]
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
        source_bytes = (SOURCE_DIR / plan.source_name).read_bytes()
        report_lines.append(f"- Source SHA-256: `{sha256(source_bytes).hexdigest()}`")
        report_lines.append(
            f"- Preserved dimensions: `{plan.dimensions[0]} x {plan.dimensions[1]}`",
        )
        if plan.preserve_existing_output:
            report_lines.extend(("- Preserved reviewed local-only restoration.", ""))
            continue
        report_lines.extend(process(plan))
        report_lines.append("")

    (OUTPUT_DIR / "MASK_REPORT.md").write_text(
        "\n".join(report_lines),
        encoding="utf-8",
    )
    print(f"Prepared {len(PLANS)} local battlefield assets in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
