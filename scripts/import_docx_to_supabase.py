from __future__ import annotations

import os
import re

import psycopg
from docx import Document


ROOT = r"c:\D\ИИ\Проекты с ии\Тест аттестация"
DOCX_PATH = os.path.join(ROOT, "ответы (2).docx")
CONN_STR = (
    "postgresql://postgres.grqskftfsikbyrohkoac:"
    "0hMoQEva9lQ0rZL9@aws-1-ap-northeast-1.pooler.supabase.com:5432/postgres"
)
CATEGORY_NAME = "Тестирование ОИТ"


QUESTION_RE = re.compile(r"^(\d+)\.\s*(.+)$")
OPTION_SPLIT_RE = re.compile(r"([ABCD]\))")


def extract_questions():
    doc = Document(DOCX_PATH)
    paras = [p for p in doc.paragraphs if (p.text or "").strip()]

    items: list[dict] = []
    i = 0
    while i < len(paras) - 1:
      qtxt = (paras[i].text or "").strip()
      match = QUESTION_RE.match(qtxt)
      if not match:
          i += 1
          continue

      question_text = match.group(2).strip()
      option_paragraph = paras[i + 1]
      runs = list(option_paragraph.runs)
      options: list[tuple[str, str, bool]] = []

      current_label: str | None = None
      current_text = ""
      current_bold = False

      def flush():
          nonlocal current_label, current_text, current_bold
          if current_label is not None:
              options.append((current_label, current_text.strip(), current_bold))
          current_label = None
          current_text = ""
          current_bold = False

      for run in runs:
          text = run.text or ""
          parts = OPTION_SPLIT_RE.split(text)
          for part in parts:
              if not part:
                  continue
              if re.fullmatch(r"[ABCD]\)", part):
                  flush()
                  current_label = part[0]
                  current_text = ""
                  current_bold = bool(run.bold)
              else:
                  if current_label is None:
                      continue
                  current_text += part
                  current_bold = current_bold or bool(run.bold)
      flush()

      normalized = []
      for label, text, is_bold in options:
          normalized.append((label, text.replace("\n", " ").strip(), is_bold))

      if len(normalized) == 4 and sum(1 for _, _, bold in normalized if bold) == 1:
          items.append(
              {
                  "question_text": question_text,
                  "options": normalized,
              }
          )
      i += 2

    return items


def main():
    items = extract_questions()
    if not items:
        raise SystemExit("No valid questions found in DOCX.")

    conn = psycopg.connect(CONN_STR)
    cur = conn.cursor()

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

    inserted = 0
    for item in items:
        cur.execute(
            """
            insert into public.questions(category_id, question_text, explanation)
            values (%s, %s, %s)
            returning id
            """,
            (
                category_id,
                item["question_text"],
                "Импортировано из файла ответы (2).docx",
            ),
        )
        question_id = cur.fetchone()[0]

        for idx, (_, option_text, is_correct) in enumerate(item["options"]):
            cur.execute(
                """
                insert into public.exam_answers(question_id, option_index, option_text, is_correct)
                values (%s, %s, %s, %s)
                """,
                (question_id, idx, option_text, is_correct),
            )
        inserted += 1

    conn.commit()
    cur.close()
    conn.close()
    print(f"inserted_questions={inserted}")


if __name__ == "__main__":
    main()

