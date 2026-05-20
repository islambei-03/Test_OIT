"""Импорт тестов ВНД из папки «Тест по ВНД» в Supabase.

Формат DOCX:
  1. Текст вопроса
  A) ...
  B) ...
  C) ...
  D) ...
  Правильный ответ: B

Запуск (из корня проекта):
  set DATABASE_URL=postgresql://...
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
VND_DIR = ROOT / "Тест по ВНД"
VND_PREFIX = "ВНД: "

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
    # fallback для локального импорта (как в import_test_oit_full.py)
    return (
        "postgresql://postgres.grqskftfsikbyrohkoac:"
        "0hMoQEva9lQ0rZL9@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
    )


def category_name_from_filename(filename: str) -> str:
    base = filename.replace(".docx", "").strip()
    base = re.sub(r"^\d+\s+", "", base)
    if base.startswith(VND_PREFIX):
        return base
    return f"{VND_PREFIX}{base}"


def parse_vnd_docx(path: Path) -> list[dict]:
    paras = [p.text.strip() for p in Document(path).paragraphs if p.text.strip()]
    items: list[dict] = []
    i = 0
    while i < len(paras):
        qm = QUESTION_RE.match(paras[i])
        if not qm:
            i += 1
            continue

        question_text = qm.group(2).strip()
        options: dict[str, str] = {}
        correct_letter: str | None = None
        i += 1

        while i < len(paras):
            line = paras[i]
            if QUESTION_RE.match(line) and options:
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
                continue

            if len(options) >= 4 and correct_letter:
                break

            i += 1

        if len(options) == 4 and correct_letter and correct_letter in LETTER_TO_INDEX:
            ordered = [options.get("A", ""), options.get("B", ""), options.get("C", ""), options.get("D", "")]
            if all(ordered):
                items.append(
                    {
                        "question_text": question_text,
                        "correct_index": LETTER_TO_INDEX[correct_letter],
                        "options": ordered,
                    }
                )
        else:
            # пропускаем битый блок
            pass

    return items


def main() -> None:
    if not VND_DIR.is_dir():
        raise SystemExit(f"Папка не найдена: {VND_DIR}")

    conn_str = load_database_url()
    all_files = sorted(VND_DIR.glob("*.docx"))
    if not all_files:
        raise SystemExit("Нет .docx в папке Тест по ВНД")

    conn = psycopg.connect(conn_str)
    cur = conn.cursor()

    total_questions = 0
    for docx_path in all_files:
        cat_name = category_name_from_filename(docx_path.name)
        items = parse_vnd_docx(docx_path)
        if not items:
            print(f"SKIP (0 questions): {docx_path.name}")
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

        # Перезаписываем вопросы категории (без дублей при повторном импорте)
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
                    f"Импорт ВНД: {docx_path.name}",
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
    print(f"Готово. Всего импортировано вопросов ВНД: {total_questions}")


if __name__ == "__main__":
    main()
