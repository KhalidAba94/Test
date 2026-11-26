"""OCR the image-only pages of archive PDFs into a text cache (one file per page).

Usage: python ocr_pages.py <archive_root> <cache_dir> <list_of_pdfs.txt> [workers]

<list_of_pdfs.txt> holds one PDF path per line, relative to <archive_root>
(e.g. "Banks/1150_ALINMA/2026_Q3_filed2026-10-28.pdf"). A page is OCR'd when
its text layer has fewer than 200 non-space characters. The cache file is
<cache_dir>/<pdf path with / replaced by __>/<page>.txt, so reruns skip
pages already done. Tesseract 5 (psm 6) at 200 dpi.
"""
from __future__ import annotations

import os
import subprocess
import sys
import tempfile
from concurrent.futures import ProcessPoolExecutor


def low_text_pages(pdf):
    info = subprocess.run(["pdfinfo", pdf], capture_output=True, text=True).stdout
    n = int(next((l.split()[-1] for l in info.splitlines() if l.startswith("Pages:")), "0"))
    txt = subprocess.run(["pdftotext", "-layout", pdf, "-"], capture_output=True, text=True).stdout.split("\f")
    return [i + 1 for i in range(n) if len("".join((txt[i] if i < len(txt) else "").split())) < 200]


def ocr_one(args):
    pdf, page, out = args
    if os.path.exists(out):
        return out, "cached"
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["pdftoppm", "-r", "200", "-f", str(page), "-l", str(page), "-png", pdf, os.path.join(d, "pg")], capture_output=True)
        imgs = [f for f in os.listdir(d) if f.endswith(".png")]
        if not imgs:
            open(out, "w").write("")
            return out, "no image"
        txt = subprocess.run(["tesseract", os.path.join(d, imgs[0]), "-", "--psm", "6"], capture_output=True, text=True).stdout
    open(out, "w", encoding="utf-8").write(txt)
    return out, "ok"


def main(root, cache, listfile, workers="4"):
    jobs = []
    for rel in [l.strip() for l in open(listfile) if l.strip()]:
        pdf = os.path.join(root, rel)
        d = os.path.join(cache, rel.replace("/", "__"))
        os.makedirs(d, exist_ok=True)
        for p in low_text_pages(pdf):
            jobs.append((pdf, p, os.path.join(d, f"{p}.txt")))
    print(f"{len(jobs)} pages to OCR", flush=True)
    done = 0
    with ProcessPoolExecutor(int(workers)) as ex:
        for _ in ex.map(ocr_one, jobs, chunksize=4):
            done += 1
            if done % 50 == 0:
                print(f"{done}/{len(jobs)}", flush=True)
    print("done", done)


if __name__ == "__main__":
    main(*sys.argv[1:5])
