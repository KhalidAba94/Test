"""List the image-only pages of each archive PDF that were read by OCR.

Usage: python scanned_pages.py <root_dir> <ocr_cache_dir>
Writes data/trace/scanned_pages.csv: pdf (sector/company/file), ocr_pages
(image-only pages read by OCR) and statement_pages (those that are primary
statements: income statement, balance sheet, cash flows, changes in equity).
"""
import csv
import os
import re
import sys

STMT = re.compile(r"statement of (profit|income|financial position|cash flows|comprehensive|changes in (shareholders' )?equity)|balance sheet|income statement", re.I)


def main(root, cache):
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import sectors   # only the archive folders of this root's sectors (the cache is shared between sets)
    archives = {s["archive"] for s in sectors.load(root)}
    rows = []
    for d in sorted(os.listdir(cache)):
        if d.split("__")[0] not in archives:
            continue
        pages, stm = [], []
        for f in sorted(os.listdir(os.path.join(cache, d)), key=lambda x: int(x[:-4]) if x[:-4].isdigit() else 0):
            if not f.endswith(".txt"):
                continue
            t = open(os.path.join(cache, d, f), encoding="utf-8", errors="ignore").read()
            pages.append(int(f[:-4]))
            if len(re.findall(r"\d{1,3}(?:[,.]\d{3})+", t)) >= 10 and (STMT.search(t[:1500]) or re.search(r"Balance at (January|1 January|31 December|December)", t)):
                stm.append(int(f[:-4]))
        rows.append({"pdf": d.replace("__", "/"), "ocr_pages": ",".join(map(str, sorted(pages))), "statement_pages": ",".join(map(str, sorted(stm)))})
    os.makedirs(os.path.join(root, "data", "trace"), exist_ok=True)
    with open(os.path.join(root, "data", "trace", "scanned_pages.csv"), "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=["pdf", "ocr_pages", "statement_pages"])
        w.writeheader(); w.writerows(rows)
    print(len(rows), "PDFs with OCR pages;", sum(1 for r in rows if r["statement_pages"]), "with scanned statement pages")


if __name__ == "__main__":
    main(*sys.argv[1:3])
