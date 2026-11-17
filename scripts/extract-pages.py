# Renders chosen PDF pages from raw-assets/ as PNGs into public/uploads/images/.
# Run from the project root:  python scripts/extract-pages.py   (needs: pip install pymupdf)
import os
import pymupdf

WIDTH = 2400  # output width in pixels
OUT = "public/uploads/images"
PAGES = {
    "01-bialetti-pressure-patience/case-study.pdf": {13: "bialetti-cover", 12: "bialetti-1", 16: "bialetti-2"},
    "02-target-high-taste-low-stakes/case-study.pdf": {5: "target-cover", 7: "target-1", 9: "target-2"},
    "03-kin-euphorics-flow-state/case-study.pdf": {11: "kin-cover", 10: "kin-1"},
    "04-nascar-orvis-headline-vs-visual/case-study.pdf": {12: "nascar-orvis-cover", 29: "nascar-orvis-1"},
    "05-ai-companion-research-strategy/brand strategy.pdf": {5: "ai-companion-cover", 8: "ai-companion-1"},
    "06-asher-rye-digital-experience/case-study.pdf": {7: "asher-rye-cover", 3: "asher-rye-1"},
}

os.makedirs(OUT, exist_ok=True)
for pdf, pages in PAGES.items():
    doc = pymupdf.open(os.path.join("raw-assets", pdf))
    for number, name in pages.items():
        page = doc[number - 1]
        zoom = WIDTH / page.rect.width
        pix = page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        path = f"{OUT}/{name}.png"
        pix.save(path)
        print(f"{path}  {pix.width}x{pix.height}  {os.path.getsize(path) // 1024} KB")
