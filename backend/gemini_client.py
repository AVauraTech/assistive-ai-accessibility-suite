"""Thin client for Google Gemini (multimodal) used for v2.0 cloud-AI features.

Everything degrades gracefully: if GEMINI_API_KEY is unset or a call fails, the
functions return None so callers can fall back to the local pipeline.
"""
import os
import base64
import requests

API_BASE = "https://generativelanguage.googleapis.com/v1beta/models"
MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")
TIMEOUT = 30


def is_available() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def _strip_data_url(b64: str):
    mime = "image/jpeg"
    data = b64
    if "," in b64 and b64.strip().lower().startswith("data:"):
        header, data = b64.split(",", 1)
        # data:image/jpeg;base64
        try:
            mime = header[5:].split(";", 1)[0] or mime
        except Exception:
            mime = "image/jpeg"
    return mime, data


def _generate(parts):
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        return None
    url = f"{API_BASE}/{MODEL}:generateContent"
    payload = {"contents": [{"parts": parts}]}
    try:
        resp = requests.post(url, params={"key": key}, json=payload, timeout=TIMEOUT)
        resp.raise_for_status()
        body = resp.json()
        candidates = body.get("candidates") or []
        if not candidates:
            return None
        chunks = candidates[0].get("content", {}).get("parts", [])
        text = "".join(c.get("text", "") for c in chunks).strip()
        return text or None
    except Exception as e:
        print(f"[gemini] generateContent error: {e}")
        return None


def describe_scene(base64_image: str, question: str | None = None) -> str | None:
    """Contextual, spatial scene description aimed at a blind/low-vision user."""
    mime, data = _strip_data_url(base64_image)
    prompt = question or (
        "You are assisting a blind person. Describe this scene in 2-3 spoken "
        "sentences. Lead with the most important object and give its spatial "
        "position relative to the user (e.g. 'to your right', 'about an arm's "
        "length away', 'near the edge of the table'). Mention any hazards. "
        "Use plain, natural language. Do not list bounding boxes or coordinates."
    )
    parts = [
        {"text": prompt},
        {"inline_data": {"mime_type": mime, "data": data}},
    ]
    return _generate(parts)


def simplify_text(text: str, reading_level: str = "5th grade") -> str | None:
    """Rewrite complex text into plain language with bullet takeaways."""
    prompt = (
        f"Rewrite the following text for a reader with dyslexia or aphasia at a "
        f"{reading_level} reading level. Use short sentences, common words, and "
        f"active voice. After the rewrite, add a section titled 'Key points:' "
        f"with 3-5 short bullets. Preserve all essential meaning and any numbers.\n\n"
        f"TEXT:\n{text[:12000]}"
    )
    return _generate([{"text": prompt}])
