"""OCR the image-only pages of archive PDFs into a text cache (one file per page).

Usage: python ocr_pages.py <archive_root> <cache_dir> <list_of_pdfs.txt> [workers]

<list_of_pdfs.txt> holds one PDF path per line, relative to <archive_root>
(e.g. "Banks/1150_ALINMA/2026_Q3_filed2026-10-28.pdf"). A page is OCR'd when
its text layer has fewer than 200 non-space characters. The cache file is
<cache_dir>/<pdf path with / replaced by __>/<page>.txt, so reruns skip
pages already done. Tesseract 5 (psm 6) at 200 dpi.

  python ocr_pages.py <archive_root> <cache_dir> --rotate [workers]
re-reads cached pages that came out unreadable (long text but almost no
comma-grouped numbers, i.e. a landscape statement scanned sideways): the page
is OCR'd turned 90 and 270 degrees and the reading with most numbers is kept.
Set OMP_THREAD_LIMIT=1 when running several workers.
"""
from __future__ import annotations

import os
import re
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


def numbers(txt):
    return len(re.findall(r"\d{1,3}(?:,\d{3})+", txt))


def unreadable(txt):
    words = len(re.findall(r"\b(?:the|of|and|total|income|balance|equity|for|year|assets|cash|net)\b", txt, re.I))
    return len(txt) > 800 and numbers(txt) < 5 and words < 8


def rotate_one(args):
    pdf, page, out = args
    from PIL import Image
    best = open(out, encoding="utf-8", errors="ignore").read()
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(["pdftoppm", "-r", "200", "-f", str(page), "-l", str(page), "-png", pdf, os.path.join(d, "pg")], capture_output=True)
        imgs = [f for f in os.listdir(d) if f.startswith("pg") and f.endswith(".png")]
        if not imgs:
            return out, "no image"
        for a in (90, 270):
            rp = os.path.join(d, f"r{a}.png")
            Image.open(os.path.join(d, imgs[0])).rotate(a, expand=True).save(rp)
            txt = subprocess.run(["tesseract", rp, "-", "--psm", "6"], capture_output=True, text=True).stdout
            if numbers(txt) > numbers(best):
                best = txt
    open(out, "w", encoding="utf-8").write(best)
    return out, "rotated" if numbers(best) >= 5 else "still unreadable"


def rotate_main(root, cache, workers="3"):
    jobs = []
    for d in sorted(os.listdir(cache)):
        rel = d.replace("__", "/")
        for f in os.listdir(os.path.join(cache, d)):
            out = os.path.join(cache, d, f)
            if f.endswith(".txt") and unreadable(open(out, encoding="utf-8", errors="ignore").read()):
                jobs.append((os.path.join(root, rel), int(f[:-4]), out))
    print(f"{len(jobs)} unreadable pages to re-read rotated", flush=True)
    res = {}
    with ProcessPoolExecutor(int(workers)) as ex:
        for _, s in ex.map(rotate_one, jobs):
            res[s] = res.get(s, 0) + 1
    print(res)


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
    if len(sys.argv) > 3 and sys.argv[3] == "--rotate":
        rotate_main(sys.argv[1], sys.argv[2], *(sys.argv[4:5]))
    else:
        main(*sys.argv[1:5])
