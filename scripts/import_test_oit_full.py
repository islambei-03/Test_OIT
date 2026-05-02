from __future__ import annotations

import json
import pathlib
import uuid

import psycopg


ROOT = pathlib.Path(r"c:\D\ИИ\Проекты с ии\Тест аттестация")
JSON_PATH = ROOT / "test_oit_full.json"

CONN_STR = (
    "postgresql://postgres.grqskftfsikbyrohkoac:"
    "0hMoQEva9lQ0rZL9@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)

CATEGORY_NAME = "Тестирование ОИТ"


LETTER_TO_INDEX = {"A": 0, "B": 1, "C": 2, "D": 3}


def main() -> None:
    raw = JSON_PATH.read_text(encoding="utf-8")
    items = json.loads(raw)
    if not isinstance(items, list) or not items:
        raise SystemExit("JSON должен быть непустым массивом.")

    # Basic validation
    for it in items:
        if not isinstance(it, dict):
            raise SystemExit("Каждый элемент должен быть объектом.")
        if "question" not in it or "options" not in it or "correct_answer" not in it:
            raise SystemExit("Ожидаются поля question/options/correct_answer.")
        opt = it["options"]
        if not isinstance(opt, dict) or any(k not in opt for k in ["A", "B", "C", "D"]):
            raise SystemExit("options должен содержать A,B,C,D.")
        ca = str(it["correct_answer"]).strip().upper()
        if ca not in LETTER_TO_INDEX:
            raise SystemExit(f"Некорректный correct_answer: {it['correct_answer']}")

    conn = psycopg.connect(CONN_STR)
    cur = conn.cursor()

    # Upsert category
    cur.execute(
        """
        insert into public.categories(name)
        values (%s)
        on conflict (name) do update set name = excluded.name
        returning id
        """,
        (CATEGORY_NAME,),
    )
    category_id = cur.fetchone()[0]

    # Clean old questions for this category to avoid duplicates
    cur.execute("delete from public.questions where category_id = %s", (category_id,))

    # Bulk insert: pre-generate UUIDs (fast, no RETURNING per row)
    question_rows = []
    answer_rows = []
    for it in items:
        qid = str(uuid.uuid4())
        question_text = str(it["question"]).strip()
        options = it["options"]
        correct_letter = str(it["correct_answer"]).strip().upper()
        correct_idx = LETTER_TO_INDEX[correct_letter]

        question_rows.append((qid, category_id, question_text, None))

        ordered = [options["A"], options["B"], options["C"], options["D"]]
        for idx, text in enumerate(ordered):
            answer_rows.append((str(uuid.uuid4()), qid, idx, str(text).strip(), idx == correct_idx))

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

    inserted_q = len(question_rows)
    inserted_a = len(answer_rows)

    conn.commit()
    cur.close()
    conn.close()
    print(f"category={CATEGORY_NAME}")
    print(f"inserted_questions={inserted_q}")
    print(f"inserted_answers={inserted_a}")


if __name__ == "__main__":
    main()

