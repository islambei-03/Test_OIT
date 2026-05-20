"""Импорт тестов «Тест ВНД» из DOCX в Supabase.

Папки (не в Git — длинные имена):
  - Тест Профильные/
  - Положение об отделе/

Категории в БД: «Тест ВНД · <название документа>»

Запуск:
  python scripts/import_vnd_docx.py
"""

from __future__ import annotations

import os
import re
import uuid
from pathlib import Path

import psycopg
from docx import Document

ROOT = Path(__file__).resolve().parents[1]
IMPORT_DIRS = [
    ROOT / "Тест Профильные",
    ROOT / "Тест по ВНД",  # старое имя, если ещё не переименовали
    ROOT / "Положение об отделе",
]
TEST_VND_LABEL = "Тест ВНД"
CATEGORY_PREFIX = f"{TEST_VND_LABEL} · "

QUESTION_RE = re.compile(r"^(\d+)\.\s*(.+)$")
OPTION_RE = re.compile(r"^([A-D])\)\s*(.+)$", re.IGNORECASE)
ANSWER_RE = re.compile(r"Правильный\s+ответ:\s*\*?\*?([A-D])\*?\*?", re.IGNORECASE)

LETTER_TO_INDEX = {"A": 0, "B": 1, "C": 2, "D": 3}


def load_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "").strip()
    if url:
        return url
    env_path = ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, val = line.split("=", 1)
            if key.strip() == "DATABASE_URL":
                return val.strip().strip('"').strip("'")
    return (
        "postgresql://postgres.grqskftfsikbyrohkoac:"
        "0hMoQEva9lQ0rZL9@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
    )


def category_name_from_filename(filename: str) -> str:
    base = filename.replace(".docx", "").strip()
    base = re.sub(r"^\d+\s+", "", base)
    if base.startswith(CATEGORY_PREFIX):
        return base
    if base.startswith(f"{TEST_VND_LABEL}:") or base.startswith(f"{TEST_VND_LABEL} ·"):
        return base
    return f"{CATEGORY_PREFIX}{base}"


def _try_parse_block(question_text: str, paras: list[str], start: int) -> tuple[dict | None, int]:
    options: dict[str, str] = {}
    correct_letter: str | None = None
    i = start
    while i < len(paras):
        line = paras[i]
        if QUESTION_RE.match(line) and options:
            break
        if not OPTION_RE.match(line) and not ANSWER_RE.search(line) and len(options) >= 4 and correct_letter:
            break

        om = OPTION_RE.match(line)
        if om:
            options[om.group(1).upper()] = om.group(2).strip()
            i += 1
            continue

        am = ANSWER_RE.search(line)
        if am:
            correct_letter = am.group(1).upper()
            i += 1
            break

        if len(options) >= 4 and correct_letter:
            break

        if not options and not OPTION_RE.match(line):
            break

        i += 1

    if len(options) != 4 or not correct_letter or correct_letter not in LETTER_TO_INDEX:
        return None, start + 1

    ordered = [options.get("A", ""), options.get("B", ""), options.get("C", ""), options.get("D", "")]
    if not all(ordered):
        return None, start + 1

    return (
        {
            "question_text": question_text,
            "correct_index": LETTER_TO_INDEX[correct_letter],
            "options": ordered,
        },
        i,
    )


def parse_vnd_docx(path: Path) -> list[dict]:
    paras = [p.text.strip() for p in Document(path).paragraphs if p.text.strip()]
    items: list[dict] = []
    i = 0
    while i < len(paras):
        line = paras[i]
        qm = QUESTION_RE.match(line)
        if qm:
            block, i = _try_parse_block(qm.group(2).strip(), paras, i + 1)
            if block:
                items.append(block)
            continue

        if i + 1 < len(paras) and OPTION_RE.match(paras[i + 1]):
            block, i = _try_parse_block(line, paras, i + 1)
            if block:
                items.append(block)
            continue

        i += 1

    return items


def collect_docx_files() -> list[Path]:
    files: list[Path] = []
    seen: set[str] = set()
    for folder in IMPORT_DIRS:
        if not folder.is_dir():
            continue
        for path in sorted(folder.glob("*.docx")):
            key = path.name.lower()
            if key in seen:
                continue
            seen.add(key)
            files.append(path)
    return files


def purge_old_vnd_categories(cur) -> None:
    cur.execute(
        """
        delete from public.questions
        where category_id in (
          select id from public.categories
          where name like 'ВНД:%'
             or name like 'Тест ВНД%'
        )
        """
    )
    cur.execute(
        """
        delete from public.categories
        where name like 'ВНД:%'
           or name like 'Тест ВНД%'
        """
    )


def main() -> None:
    all_files = collect_docx_files()
    if not all_files:
        raise SystemExit("Нет .docx в «Тест Профильные» / «Положение об отделе»")

    conn = psycopg.connect(load_database_url())
    cur = conn.cursor()
    purge_old_vnd_categories(cur)

    total_questions = 0
    for docx_path in all_files:
        cat_name = category_name_from_filename(docx_path.name)
        items = parse_vnd_docx(docx_path)
        if not items:
            print(f"SKIP (0 questions): {docx_path.parent.name}/{docx_path.name}")
            continue

        cur.execute(
            """
            insert into public.categories(name)
            values (%s)
            on conflict (name) do update set name = excluded.name
            returning id
            """,
            (cat_name,),
        )
        category_id = cur.fetchone()[0]
        cur.execute("delete from public.questions where category_id = %s", (category_id,))

        question_rows = []
        answer_rows = []
        for item in items:
            qid = str(uuid.uuid4())
            question_rows.append(
                (
                    qid,
                    category_id,
                    item["question_text"],
                    f"{TEST_VND_LABEL}: {docx_path.name}",
                )
            )
            for idx, text in enumerate(item["options"]):
                answer_rows.append((str(uuid.uuid4()), qid, idx, text, idx == item["correct_index"]))

        cur.executemany(
            """
            insert into public.questions(id, category_id, question_text, explanation)
            values (%s, %s, %s, %s)
            """,
            question_rows,
        )
        cur.executemany(
            """
            insert into public.exam_answers(id, question_id, option_index, option_text, is_correct)
            values (%s, %s, %s, %s, %s)
            """,
            answer_rows,
        )

        total_questions += len(items)
        print(f"OK {cat_name}: {len(items)} вопросов")

    conn.commit()
    cur.close()
    conn.close()
    print(f"Готово. Всего вопросов «{TEST_VND_LABEL}»: {total_questions}")


if __name__ == "__main__":
    main()
