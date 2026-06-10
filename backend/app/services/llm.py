"""
LLM service for TestGen AI.
Handles provider health checks, automatic fallback, prompt chaining,
AST parsing for Python, and test generation via Mistral or Groq.
"""

import ast
import os
import httpx
from dotenv import load_dotenv
from mistralai import Mistral
from groq import Groq

load_dotenv()

# ---------------------------------------------------------------------------
# Clients
# ---------------------------------------------------------------------------
mistral_client = Mistral(api_key=os.getenv("MISTRAL_API_KEY"))
groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))

MISTRAL_MODEL = "mistral-small-latest"
GROQ_MODEL = "llama3-8b-8192"

# ---------------------------------------------------------------------------
# Health checks — lightweight requests to detect provider availability
# ---------------------------------------------------------------------------
async def _is_mistral_available() -> bool:
    """
    Ping Mistral's model list endpoint.
    If it responds in under 3 seconds, the provider is considered available.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(
                "https://api.mistral.ai/v1/models",
                headers={"Authorization": f"Bearer {os.getenv('MISTRAL_API_KEY')}"}
            )
            return response.status_code == 200
    except Exception:
        return False


async def _is_groq_available() -> bool:
    """
    Ping Groq's model list endpoint.
    If it responds in under 3 seconds, the provider is considered available.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            response = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {os.getenv('GROQ_API_KEY')}"}
            )
            return response.status_code == 200
    except Exception:
        return False


# ---------------------------------------------------------------------------
# AST parsing — extract function signatures from Python source code
# ---------------------------------------------------------------------------
def _extract_python_functions(source_code: str) -> list[dict]:
    """
    Parse Python source code and extract function names + argument names.
    Returns a list of dicts: [{ "name": "my_func", "args": ["a", "b"] }, ...]
    Falls back to empty list if the code can't be parsed.
    """
    try:
        tree = ast.parse(source_code)
    except SyntaxError:
        return []

    functions = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            args = [arg.arg for arg in node.args.args]
            functions.append({"name": node.name, "args": args})
    return functions


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------
def _build_python_prompt(source_code: str, functions: list[dict]) -> str:
    """
    Build a structured prompt for Python code.
    Uses extracted function signatures for more precise test generation.
    """
    func_summary = "\n".join(
        f"- {f['name']}({', '.join(f['args'])})" for f in functions
    ) if functions else "No functions detected — generate tests for the full code."

    return f"""You are an expert Python developer specialized in writing unit tests.

Given the following Python source code, generate complete and ready-to-run pytest unit tests.

Rules:
- Use pytest style (def test_...)
- Cover normal cases, edge cases, and error cases for each function
- Import the functions properly at the top of the test file
- Do not include any explanation, only return the test code

Detected functions:
{func_summary}

Source code:
```python
{source_code}
```

Return only the test code, nothing else."""


def _build_analysis_prompt(source_code: str, language: str) -> str:
    """
    First prompt in the chaining flow for non-Python languages.
    Asks the LLM to analyze the code structure and describe what needs to be tested.
    """
    return f"""You are a senior software engineer.

Analyze the following {language} source code and produce a structured description of:
- Each function or method found
- Its parameters and return type if identifiable
- Its apparent purpose
- What edge cases and error cases should be tested

Source code:
```{language}
{source_code}
```

Return only a structured plain-text analysis, no code."""


def _build_generation_prompt(analysis: str, language: str) -> str:
    """
    Second prompt in the chaining flow.
    Uses the analysis from the first LLM call to generate precise tests.
    """
    framework = "Jest" if language == "javascript" else f"the standard testing framework for {language}"

    return f"""You are an expert {language} developer specialized in writing unit tests.

Based on the following code analysis, generate complete and ready-to-run unit tests using {framework}.

Rules:
- Cover all functions described in the analysis
- Include normal cases, edge cases, and error cases
- Do not include any explanation, only return the test code

Code analysis:
{analysis}

Return only the test code, nothing else."""


# ---------------------------------------------------------------------------
# LLM call wrappers
# ---------------------------------------------------------------------------
async def _call_mistral(prompt: str) -> str:
    """Send a prompt to Mistral and return the response text."""
    response = mistral_client.chat.complete(
        model=MISTRAL_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


async def _call_groq(prompt: str) -> str:
    """Send a prompt to Groq and return the response text."""
    response = groq_client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[{"role": "user", "content": prompt}]
    )
    return response.choices[0].message.content


async def _call_llm(prompt: str, preferred_provider: str = "mistral") -> tuple[str, str]:
    """
    Call the preferred LLM provider with automatic fallback.
    Returns a tuple: (response_text, provider_used)
    Raises Exception if both providers are unavailable.
    """
    providers = ["mistral", "groq"] if preferred_provider == "mistral" else ["groq", "mistral"]

    for provider in providers:
        if provider == "mistral":
            available = await _is_mistral_available()
            if available:
                try:
                    result = await _call_mistral(prompt)
                    return result, "mistral"
                except Exception:
                    continue
        elif provider == "groq":
            available = await _is_groq_available()
            if available:
                try:
                    result = await _call_groq(prompt)
                    return result, "groq"
                except Exception:
                    continue

    raise Exception("All LLM providers are currently unavailable. Please try again later.")


# ---------------------------------------------------------------------------
# Main entry point — called by routes/generate.py
# ---------------------------------------------------------------------------
async def generate_tests(
    source_code: str,
    language: str,
    preferred_provider: str = "mistral"
) -> dict:
    """
    Generate unit tests for the given source code.

    For Python: uses AST parsing to extract function signatures,
    then sends a structured prompt to the LLM.

    For other languages: uses prompt chaining —
    first LLM call analyzes the code structure,
    second LLM call generates the tests from that analysis.

    Returns: { "test_code": str, "provider": str }
    """
    if language == "python":
        # Direct path — AST parsing + single LLM call
        functions = _extract_python_functions(source_code)
        prompt = _build_python_prompt(source_code, functions)
        test_code, provider = await _call_llm(prompt, preferred_provider)

    else:
        # Prompt chaining path — two sequential LLM calls
        analysis_prompt = _build_analysis_prompt(source_code, language)
        analysis, provider = await _call_llm(analysis_prompt, preferred_provider)

        generation_prompt = _build_generation_prompt(analysis, language)
        test_code, provider = await _call_llm(generation_prompt, preferred_provider)

    return {"test_code": test_code, "provider": provider}