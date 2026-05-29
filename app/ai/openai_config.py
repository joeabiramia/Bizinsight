import os

from dotenv import load_dotenv

load_dotenv()

DEFAULT_OPENAI_MODEL = "gpt-3.5-turbo"


def get_openai_model() -> str:
    """Return the configured OpenAI model, defaulting to the lowest-cost testing model."""
    return os.getenv("OPENAI_MODEL", DEFAULT_OPENAI_MODEL)
