"""Clean model-written SVG: remove anything unsafe/heavy, namespace ids."""
import re
import xml.etree.ElementTree as ET

SVG_NS = "http://www.w3.org/2000/svg"
XLINK = "http://www.w3.org/1999/xlink"
ET.register_namespace("", SVG_NS)
ET.register_namespace("xlink", XLINK)

ALLOWED = {
    "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs",
    "linearGradient", "radialGradient", "stop", "clipPath", "mask", "use", "symbol", "title",
    "animate", "animateTransform", "animateMotion", "set", "mpath", "pattern", "text", "tspan",
}
BAD_ATTR = re.compile(r"^on|^style$", re.I)


def _local(tag):
    return tag.split("}", 1)[-1]


def extract_svg(text):
    m = re.search(r"<svg[\s\S]*?</svg>", text, re.I)
    return m.group(0) if m else None


def _clean_style(val):
    # keep simple presentation props only
    keep = []
    for decl in val.split(";"):
        if ":" not in decl:
            continue
        k, v = [x.strip() for x in decl.split(":", 1)]
        if k.lower() in {"fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity",
                         "stroke-linecap", "stroke-linejoin", "stop-color", "stop-opacity", "mix-blend-mode"} \
                and "url(" not in v.lower().replace("url(#", ""):
            keep.append(f"{k}:{v}")
    return ";".join(keep)


def sanitize(svg_text, prefix):
    """Returns (clean_svg_string, aspect_ratio h/w) or raises ValueError."""
    raw = extract_svg(svg_text or "")
    if not raw:
        raise ValueError("no <svg> found")
    raw = re.sub(r"<!DOCTYPE[^>]*>", "", raw, flags=re.I)
    raw = re.sub(r"&(?!amp;|lt;|gt;|quot;|apos;|#)", "&amp;", raw)
    if 'xmlns="' not in raw[:300]:
        raw = raw.replace("<svg", f'<svg xmlns="{SVG_NS}"', 1)
    if "xlink:" in raw and "xmlns:xlink" not in raw:
        raw = raw.replace("<svg", f'<svg xmlns:xlink="{XLINK}"', 1)
    root = ET.fromstring(raw)
    if _local(root.tag) != "svg":
        raise ValueError("root is not svg")

    def walk(el):
        for child in list(el):
            if _local(child.tag) not in ALLOWED:
                el.remove(child)
                continue
            walk(child)
        for k in list(el.attrib):
            lk = _local(k)
            v = el.attrib[k]
            if BAD_ATTR.match(lk) and lk != "style":
                del el.attrib[k]
            elif lk == "style":
                cleaned = _clean_style(v)
                if cleaned:
                    el.attrib[k] = cleaned
                else:
                    del el.attrib[k]
            elif lk == "href" and not v.startswith("#"):
                del el.attrib[k]
            elif "javascript:" in v.lower():
                del el.attrib[k]
    walk(root)

    vb = root.attrib.get("viewBox") or root.attrib.get("viewbox")
    if not vb:
        w = re.sub(r"[^\d.]", "", root.attrib.get("width", "") or "1000") or "1000"
        h = re.sub(r"[^\d.]", "", root.attrib.get("height", "") or "1000") or "1000"
        vb = f"0 0 {w} {h}"
        root.attrib["viewBox"] = vb
    nums = [float(x) for x in re.split(r"[\s,]+", vb.strip()) if x]
    if len(nums) != 4 or nums[2] <= 0 or nums[3] <= 0:
        raise ValueError("bad viewBox")
    aspect = nums[3] / nums[2]
    for a in ("width", "height", "x", "y"):
        root.attrib.pop(a, None)
    root.attrib["preserveAspectRatio"] = "xMidYMid meet"

    out = ET.tostring(root, encoding="unicode")
    # namespace ids so different drawings never clash
    ids = set(re.findall(r'\sid="([^"]+)"', out))
    for i in sorted(ids, key=len, reverse=True):
        new = f"{prefix}-{i}"
        out = re.sub(rf'(\sid=")({re.escape(i)})(")', rf"\g<1>{new}\g<3>", out)
        out = out.replace(f"url(#{i})", f"url(#{new})").replace(f'"#{i}"', f'"#{new}"')
        out = re.sub(rf"(begin=\"[^\"]*?)\b{re.escape(i)}\.", rf"\g<1>{new}.", out)
    shapes = len(re.findall(r"<(path|rect|circle|ellipse|polygon|polyline|line)\b", out))
    if shapes < 3:
        raise ValueError("drawing too empty")
    if len(out) > 220_000:
        raise ValueError("drawing too heavy")
    return out, aspect
