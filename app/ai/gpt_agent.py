import os

import pandas as pd
from dotenv import load_dotenv

from app.ai.openai_config import get_openai_model

load_dotenv()


def ask_ai(df: pd.DataFrame, question: str) -> dict:
    """
    Generates a pandas expression for the given question using the OpenAI API.
    The generated code is returned for inspection only — it is NOT executed,
    as eval() on untrusted LLM output is a security risk.
    """
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"generated_code": "", "result": "OpenAI API key not configured."}

    try:
        from openai import OpenAI
        client = OpenAI(api_key=api_key)
        columns = list(df.columns)
        prompt = (
            "You are a data analyst.\n\n"
            f"Dataset columns: {columns}\n\n"
            f"User question: {question}\n\n"
            "Return ONLY a single Python pandas expression to compute the answer.\n"
            "Example: df[\"sales\"].mean()"
        )
        response = client.chat.completions.create(
            model=get_openai_model(),
            messages=[{"role": "user", "content": prompt}],
        )
        code = response.choices[0].message.content.strip()
        return {"generated_code": code, "result": "Review the generated_code above."}
    except Exception as exc:
        return {"generated_code": "", "result": f"GPT request failed: {exc.__class__.__name__}"}