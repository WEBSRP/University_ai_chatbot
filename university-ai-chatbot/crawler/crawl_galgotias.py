from __future__ import annotations

import argparse
import hashlib
import json
import logging
import re
import time
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable
from urllib.parse import urljoin, urlparse, urlunparse
from xml.etree import ElementTree

import requests
import trafilatura
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


DEFAULT_SITEMAP_URL = "https://www.galgotiasuniversity.edu.in/sitemap.xml"
DEFAULT_OUTPUT_DIR = Path("knowledge")
USER_AGENT = (
    "GalgotiasAdmissionKnowledgeCrawler/1.0 "
    "(admission chatbot knowledge-base builder; respectful crawler)"
)

URL_FILTER_KEYWORDS = {
    "admission",
    "admissions",
    "apply",
    "application",
    "courses",
    "course",
    "programs",
    "program",
    "schools",
    "school",
    "departments",
    "department",
    "fees",
    "fee",
    "hostel",
    "placement",
    "placements",
    "scholarship",
    "scholarships",
    "contact",
    "eligibility",
}

CATEGORY_KEYWORDS: dict[str, set[str]] = {
    "admissions": {
        "admission",
        "admissions",
        "apply",
        "application",
        "eligibility",
        "entrance",
        "enquire",
        "brochure",
    },
    "courses": {
        "course",
        "courses",
        "program",
        "programs",
        "programme",
        "programmes",
        "school",
        "schools",
        "department",
        "departments",
        "academics",
        "curriculum",
        "undergraduate",
        "postgraduate",
        "doctoral",
        "diploma",
        "certificate",
    },
    "fees": {"fee", "fees", "tuition", "payment", "education-loan", "loan"},
    "hostel": {"hostel", "accommodation", "residence", "residential"},
    "placements": {"placement", "placements", "recruiter", "recruiters", "career", "cpdd"},
    "scholarships": {"scholarship", "scholarships", "financial-aid"},
    "contact": {"contact", "address", "phone", "email", "reach-us", "locate"},
}

BOILERPLATE_SELECTORS = [
    "header",
    "footer",
    "nav",
    "aside",
    "form",
    "script",
    "style",
    "noscript",
    "iframe",
    "svg",
    ".navbar",
    ".navCrousal",
    ".tpHeader",
    ".login",
    ".site-header",
    ".site-footer",
    ".footer",
    ".sidebar",
    ".cookie",
    ".cookie-banner",
    ".npf_chatbots",
    ".modal",
    ".global-search-box",
    ".breadcrumb",
    ".marquee",
]

SKIP_EXTENSIONS = {
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".ico",
    ".css",
    ".js",
    ".pdf",
    ".zip",
    ".rar",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".ppt",
    ".pptx",
}


@dataclass(frozen=True)
class CrawlResult:
    title: str
    url: str
    category: str
    content: str


def build_session() -> requests.Session:
    retry = Retry(
        total=4,
        connect=4,
        read=4,
        status=4,
        backoff_factor=0.8,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=("GET", "HEAD"),
        raise_on_status=False,
    )
    adapter = HTTPAdapter(max_retries=retry, pool_connections=16, pool_maxsize=16)
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept": "text/html,application/xml,text/xml,*/*"})
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


def normalize_url(url: str) -> str:
    parsed = urlparse(url.strip())
    scheme = parsed.scheme.lower() or "https"
    netloc = parsed.netloc.lower()
    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    if path != "/" and path.endswith("/"):
        path = path[:-1]
    return urlunparse((scheme, netloc, path, "", parsed.query, ""))


def same_site(url: str, root_url: str) -> bool:
    return urlparse(url).netloc.lower() == urlparse(root_url).netloc.lower()


def is_probable_html_url(url: str) -> bool:
    suffix = Path(urlparse(url).path).suffix.lower()
    return suffix not in SKIP_EXTENSIONS


def parse_xml_locs(xml_text: str) -> list[str]:
    root = ElementTree.fromstring(xml_text.encode("utf-8"))
    locs: list[str] = []
    for element in root.iter():
        if element.tag.split("}")[-1] == "loc" and element.text:
            locs.append(element.text.strip())
    return locs


def fetch_text(session: requests.Session, url: str, timeout: float) -> tuple[str, str]:
    response = session.get(url, timeout=timeout)
    response.raise_for_status()
    content_type = response.headers.get("content-type", "")
    return response.text, content_type


def discover_urls(session: requests.Session, sitemap_url: str, timeout: float) -> list[str]:
    seen_sitemaps: set[str] = set()
    seen_urls: set[str] = set()
    pending = [normalize_url(sitemap_url)]
    root_site = f"{urlparse(sitemap_url).scheme}://{urlparse(sitemap_url).netloc}"

    while pending:
        current = pending.pop()
        if current in seen_sitemaps:
            continue
        seen_sitemaps.add(current)
        logging.info("Reading sitemap: %s", current)

        xml_text, _ = fetch_text(session, current, timeout)
        for loc in parse_xml_locs(xml_text):
            absolute = normalize_url(urljoin(current, loc))
            if not same_site(absolute, root_site):
                continue
            path = urlparse(absolute).path.lower()
            if path.endswith(".xml"):
                pending.append(absolute)
            else:
                seen_urls.add(absolute)

    return sorted(seen_urls)


def filter_relevant_urls(urls: Iterable[str]) -> list[str]:
    filtered: list[str] = []
    for url in urls:
        parsed = urlparse(url)
        haystack = f"{parsed.path} {parsed.query}".lower().replace("-", " ").replace("_", " ")
        if not is_probable_html_url(url):
            continue
        if any(keyword in haystack for keyword in URL_FILTER_KEYWORDS):
            filtered.append(url)
    return sorted(set(filtered))


def remove_boilerplate(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for selector in BOILERPLATE_SELECTORS:
        for node in soup.select(selector):
            node.decompose()
    for node in soup.find_all(attrs={"role": re.compile(r"(navigation|banner|contentinfo)", re.I)}):
        node.decompose()
    return str(soup)


def extract_title(html: str) -> str:
    soup = BeautifulSoup(html, "html.parser")
    for selector in [
        'meta[property="og:title"]',
        'meta[name="twitter:title"]',
        "title",
        "h1",
    ]:
        node = soup.select_one(selector)
        if not node:
            continue
        value = node.get("content") if node.name == "meta" else node.get_text(" ", strip=True)
        if value:
            return clean_text(value)
    return ""


def fallback_content(html: str) -> str:
    soup = BeautifulSoup(remove_boilerplate(html), "html.parser")
    main = soup.select_one("main, article, .content, .main-content, .page-content, body")
    if not main:
        return ""
    return clean_text(main.get_text("\n", strip=True))


def extract_content(html: str, url: str) -> str:
    stripped_html = remove_boilerplate(html)
    extracted = trafilatura.extract(
        stripped_html,
        url=url,
        include_comments=False,
        include_tables=True,
        favor_precision=True,
        deduplicate=True,
    )
    content = clean_text(extracted or "")
    if len(content) < 300:
        content = fallback_content(html)
    return content


def clean_text(value: str) -> str:
    value = value.replace("\xa0", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    lines = [line.strip() for line in value.splitlines()]
    lines = [line for line in lines if line]
    deduped_lines: list[str] = []
    previous = ""
    for line in lines:
        if line != previous:
            deduped_lines.append(line)
        previous = line
    return "\n".join(deduped_lines).strip()


def tokenize(value: str) -> list[str]:
    return re.findall(r"[a-z0-9]+(?:-[a-z0-9]+)?", value.lower())


def categorize(url: str, title: str, content: str) -> str:
    parsed = urlparse(url)
    weighted_text = " ".join(
        [
            " ".join([parsed.path.replace("/", " ")] * 5),
            " ".join([parsed.query.replace("=", " ")] * 3),
            " ".join([title] * 4),
            content[:4000],
        ]
    )
    tokens = tokenize(weighted_text)
    counts = Counter(tokens)

    scores: dict[str, int] = {}
    for category, keywords in CATEGORY_KEYWORDS.items():
        score = 0
        for keyword in keywords:
            normalized = keyword.lower()
            score += counts[normalized]
            score += weighted_text.lower().count(normalized.replace("-", " "))
            score += weighted_text.lower().count(normalized)
        scores[category] = score

    category, score = max(scores.items(), key=lambda item: item[1])
    return category if score > 0 else "other"


def load_existing_index(output_dir: Path) -> tuple[set[str], list[dict[str, str]]]:
    index_path = output_dir / "index.json"
    if not index_path.exists():
        records: list[dict[str, str]] = []
    else:
        try:
            records = json.loads(index_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logging.warning("Existing index.json is invalid; falling back to scanning page files.")
            records = []

    urls = {normalize_url(item["url"]) for item in records if isinstance(item, dict) and item.get("url")}
    for path in output_dir.glob("page_*.json"):
        try:
            page = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        if page.get("url"):
            urls.add(normalize_url(page["url"]))
    return urls, records


def load_url_file_map(output_dir: Path) -> dict[str, Path]:
    mapping: dict[str, Path] = {}
    for path in sorted(output_dir.glob("page_*.json")):
        try:
            page = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        url = page.get("url")
        if isinstance(url, str) and url:
            mapping[normalize_url(url)] = path
    return mapping


def next_page_number(output_dir: Path) -> int:
    numbers: list[int] = []
    for path in output_dir.glob("page_*.json"):
        match = re.match(r"page_(\d+)\.json$", path.name)
        if match:
            numbers.append(int(match.group(1)))
    return max(numbers, default=0) + 1


def write_page(output_dir: Path, page_number: int, result: CrawlResult) -> Path:
    path = output_dir / f"page_{page_number:03d}.json"
    write_page_file(path, result)
    return path


def write_page_file(path: Path, result: CrawlResult) -> None:
    payload = {
        "title": result.title,
        "url": result.url,
        "category": result.category,
        "content": result.content,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def write_index(output_dir: Path) -> list[dict[str, str]]:
    records: list[dict[str, str]] = []
    for path in sorted(output_dir.glob("page_*.json")):
        try:
            page = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            logging.warning("Skipping invalid page file in index generation: %s", path)
            continue
        records.append(
            {
                "title": page.get("title", ""),
                "url": page.get("url", ""),
                "category": page.get("category", "other"),
            }
        )
    records.sort(key=lambda item: (item["category"], item["title"], item["url"]))
    (output_dir / "index.json").write_text(json.dumps(records, ensure_ascii=False, indent=2), encoding="utf-8")
    return records


def content_fingerprint(content: str) -> str:
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


def crawl_page(session: requests.Session, url: str, timeout: float) -> CrawlResult:
    html, content_type = fetch_text(session, url, timeout)
    if "html" not in content_type.lower() and "<html" not in html[:500].lower():
        raise ValueError(f"Non-HTML response: {content_type or 'unknown content type'}")

    title = extract_title(html)
    content = extract_content(html, url)
    if len(content) < 120:
        raise ValueError("Extracted content is too short")

    category = categorize(url, title, content)
    return CrawlResult(title=title, url=url, category=category, content=content)


def write_summary(
    output_dir: Path,
    total_discovered: int,
    total_relevant: int,
    total_processed: int,
    processed: int,
    skipped: int,
    failed: list[dict[str, str]],
    index_records: list[dict[str, str]],
) -> dict[str, object]:
    pages_per_category = Counter(item.get("category", "other") for item in index_records)
    summary = {
        "total_urls_discovered": total_discovered,
        "total_urls_matching_filters": total_relevant,
        "total_urls_processed": total_processed,
        "total_urls_processed_this_run": processed,
        "total_urls_skipped_existing": skipped,
        "failed_urls": failed,
        "pages_per_category": dict(sorted(pages_per_category.items())),
    }
    (output_dir / "summary_report.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def run(args: argparse.Namespace) -> int:
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)

    session = build_session()
    discovered = discover_urls(session, args.sitemap_url, args.timeout)
    all_relevant_urls = filter_relevant_urls(discovered)
    relevant_urls = all_relevant_urls
    if args.limit:
        relevant_urls = all_relevant_urls[: args.limit]

    existing_urls, _ = load_existing_index(output_dir)
    existing_file_by_url = load_url_file_map(output_dir)
    page_number = next_page_number(output_dir)
    processed = 0
    skipped = 0
    failed: list[dict[str, str]] = []

    logging.info("Discovered %s URLs; %s match admission KB filters.", len(discovered), len(all_relevant_urls))

    for position, url in enumerate(relevant_urls, start=1):
        normalized = normalize_url(url)
        if normalized in existing_urls and not args.force:
            skipped += 1
            logging.info("[%s/%s] Skipping existing URL: %s", position, len(relevant_urls), url)
            continue

        try:
            logging.info("[%s/%s] Crawling: %s", position, len(relevant_urls), url)
            result = crawl_page(session, normalized, args.timeout)
            if not args.force and content_fingerprint(result.content) in args.seen_hashes:
                skipped += 1
                logging.info("Skipping duplicate content: %s", url)
                continue
            existing_path = existing_file_by_url.get(normalized)
            if args.force and existing_path:
                write_page_file(existing_path, result)
            else:
                write_page(output_dir, page_number, result)
                existing_file_by_url[normalized] = output_dir / f"page_{page_number:03d}.json"
                page_number += 1
            existing_urls.add(normalized)
            args.seen_hashes.add(content_fingerprint(result.content))
            processed += 1
            time.sleep(args.delay)
        except Exception as exc:  # noqa: BLE001 - crawler should record and continue.
            logging.exception("Failed URL: %s", url)
            failed.append({"url": url, "error": str(exc)})

    index_records = write_index(output_dir)
    summary = write_summary(
        output_dir=output_dir,
        total_discovered=len(discovered),
        total_relevant=len(all_relevant_urls),
        total_processed=len(index_records),
        processed=processed,
        skipped=skipped,
        failed=failed,
        index_records=index_records,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0 if not failed else 2


def collect_existing_hashes(output_dir: Path) -> set[str]:
    hashes: set[str] = set()
    for path in output_dir.glob("page_*.json"):
        try:
            page = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            continue
        content = page.get("content")
        if isinstance(content, str) and content:
            hashes.add(content_fingerprint(content))
    return hashes


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Build an admission chatbot knowledge base from the Galgotias University sitemap."
    )
    parser.add_argument("--sitemap-url", default=DEFAULT_SITEMAP_URL, help="Sitemap URL to crawl.")
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Directory for page_###.json files.")
    parser.add_argument("--timeout", type=float, default=20.0, help="HTTP timeout in seconds.")
    parser.add_argument("--delay", type=float, default=0.4, help="Delay between page downloads in seconds.")
    parser.add_argument("--limit", type=int, default=0, help="Optional limit for testing.")
    parser.add_argument("--force", action="store_true", help="Recrawl URLs even when already present in index.json.")
    parser.add_argument("--log-level", default="INFO", choices=["DEBUG", "INFO", "WARNING", "ERROR"])
    args = parser.parse_args()
    args.seen_hashes = collect_existing_hashes(Path(args.output_dir))
    return args


def main() -> int:
    args = parse_args()
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(message)s",
    )
    return run(args)


if __name__ == "__main__":
    raise SystemExit(main())
