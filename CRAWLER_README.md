# Galgotias Admission Knowledge Crawler

This crawler reads `https://www.galgotiasuniversity.edu.in/sitemap.xml`, extracts all sitemap URLs, filters admission-chatbot-relevant pages, downloads each HTML page, extracts clean text, categorizes it, and writes JSON files into `knowledge/`.

## Folder Structure

```text
crawler/
  __init__.py
  crawl_galgotias.py
  requirements.txt
knowledge/
  .gitkeep
  page_001.json
  page_002.json
  index.json
  summary_report.json
```

The `page_###.json` files are generated at crawl time.

## Install

Use a Python virtual environment so crawler dependencies do not mix with the Next.js project.

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r crawler/requirements.txt
```

## Run

```bash
python -m crawler.crawl_galgotias
```

Useful options:

```bash
python -m crawler.crawl_galgotias --limit 10
python -m crawler.crawl_galgotias --delay 1.0
python -m crawler.crawl_galgotias --force
python -m crawler.crawl_galgotias --output-dir knowledge
```

## Output

Each page is saved as:

```json
{
  "title": "",
  "url": "",
  "category": "",
  "content": ""
}
```

`knowledge/index.json` is generated as:

```json
[
  {
    "title": "",
    "url": "",
    "category": ""
  }
]
```

`knowledge/summary_report.json` includes:

- Total URLs discovered
- Total URLs matching the filters
- Total URLs currently processed in the knowledge base
- Total URLs processed in the current run
- Skipped existing URLs
- Failed URLs
- Pages per category

## Incremental Crawling

Rerunning the crawler skips URLs already present in `knowledge/index.json`. It also avoids writing duplicate extracted content within the run by fingerprinting page text. Use `--force` to recrawl existing URLs.

## URL Filters

The crawler keeps sitemap URLs containing these terms in the path or query:

`admission`, `admissions`, `apply`, `application`, `courses`, `programs`, `schools`, `departments`, `fees`, `hostel`, `placement`, `scholarship`, `contact`, `eligibility`.

## Categories

Pages are categorized automatically into:

`admissions`, `courses`, `fees`, `hostel`, `placements`, `scholarships`, `contact`, or `other`.
