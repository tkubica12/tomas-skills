#!/usr/bin/env python3
"""Generate an optional, offline QR figure; the destination is read from stdin."""
import argparse
import html
from pathlib import Path
import sys
from urllib.parse import urlsplit


def figure(url, label, icon=False):
    import segno
    from segno import consts

    parsed = urlsplit(url)
    if (parsed.scheme not in ("http", "https") or not parsed.hostname
            or parsed.username is not None or parsed.password is not None
            or any(c.isspace() or ord(c) < 32 for c in url)):
        raise ValueError("Provide one absolute HTTP(S) URL without credentials or whitespace.")
    qr = segno.make(url, error="h", micro=False, encoding="utf-8", eci=True)
    matrix = list(qr.matrix_iter(scale=1, border=0, verbose=True))
    count = len(matrix)
    extent = count + 8
    badge = ""
    if icon:
        side = max(3, (int(count * .13) - 1) // 2 * 2 + 1)
        if side > count * .15:
            raise ValueError("Symbol too small for the icon; omit --icon.")
        start = (count - side) // 2
        data_types = (consts.TYPE_DATA_DARK, consts.TYPE_DATA_LIGHT)
        if any(matrix[y][x] not in data_types
               for y in range(start, start + side)
               for x in range(start, start + side)):
            raise ValueError("Center contains functional patterns; omit --icon.")
        center = extent / 2
        badge = (
            f'<rect x="{start + 4}" y="{start + 4}" width="{side}" height="{side}" '
            'fill="var(--qr-paper)"/>'
            f'<svg x="{center - side * .36}" y="{center - side * .36}" '
            f'width="{side * .72}" height="{side * .72}" viewBox="0 0 24 24" aria-hidden="true">'
            '<rect width="24" height="24" rx="4" fill="var(--accent-light)"/>'
            '<path d="m5 7 5 5-5 5m8 0h6" fill="none" stroke="var(--qr-paper)" '
            'stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        )
    cells = "".join(
        f"M{x + 4} {y + 4}h1v1h-1z"
        for y, row in enumerate(qr.matrix) for x, dark in enumerate(row) if dark
    )
    target = html.escape(url, quote=True)
    return (
        '<figure class="qr-card">\n  <div class="qr-frame">\n'
        f'    <svg class="qr-art" viewBox="0 0 {extent} {extent}" role="img" '
        f'aria-label="QR: {target}" xmlns="http://www.w3.org/2000/svg">\n'
        f'      <rect width="{extent}" height="{extent}" fill="var(--qr-paper)"/>\n'
        f'      <path d="{cells}" fill="var(--qr-ink)"/>{badge}\n'
        '    </svg>\n  </div>\n'
        f'  <figcaption><strong>{html.escape(label)}</strong>'
        f'<span class="qr-url">{html.escape(url)}</span></figcaption>\n</figure>\n'
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="New HTML fragment path")
    parser.add_argument("--label", default="Resources")
    parser.add_argument("--icon", action="store_true", help="Small terminal icon; must be decode-tested")
    args = parser.parse_args()
    try:
        sys.stdin.reconfigure(encoding="utf-8")
        result = figure(sys.stdin.read().rstrip("\r\n"), args.label, args.icon)
        with args.out.open("x", encoding="utf-8") as output:
            output.write(result)
    except ImportError:
        parser.exit(1, "Missing Segno. Install qr-requirements.txt using your approved Python feed.\n")
    except (ValueError, OSError) as error:
        parser.exit(1, f"QR generation failed: {error}\n")


if __name__ == "__main__":
    main()
