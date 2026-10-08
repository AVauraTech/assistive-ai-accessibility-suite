from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import json
import asyncio
from air_writing import AirWritingSystem
from ocr_system import OCRSystem
from ai_engine import AIEngine
from depth_engine import DepthEngine
import gemini_client
import threading
import uvicorn

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global Instances
air_system = AirWritingSystem()
ocr_system = OCRSystem()
ai_engine = AIEngine()
depth_engine = DepthEngine()

class ImageRequest(BaseModel):
    image: str

class TextRequest(BaseModel):
    text: str

class SimplifyRequest(BaseModel):
    text: str
    reading_level: str = "5th grade"

class SceneV2Request(BaseModel):
    image: str
    question: str | None = None

@app.get("/")
def read_root():
    return {"message": "Advanced Accessibility Suite Backend Running"}

@app.get("/api/config")
def get_config():
    """Tells the frontend which optional v2.0 features are usable right now."""
    return {
        "vlm": gemini_client.is_available(),
        "simplify": gemini_client.is_available(),
        "depth": depth_engine.is_available(),
        "model": gemini_client.MODEL if gemini_client.is_available() else None,
    }

@app.post("/api/recognize")
async def recognize_text(request: ImageRequest):
    print("Received recognition request")
    text = ocr_system.recognize_base64(request.image)
    return {"text": text}

@app.post("/api/summarize")
async def summarize_text(request: TextRequest):
    print("Received summarization request")
    summary = ai_engine.summarize_text(request.text)
    return {"summary": summary}

@app.post("/api/describe-scene")
async def describe_scene(request: ImageRequest):
    print("Received scene description request")
    description = ai_engine.describe_image(request.image)
    return {"description": description}

@app.post("/api/describe-scene-v2")
async def describe_scene_v2(request: SceneV2Request):
    """VLM-first spatial scene description with local SSDLite fallback."""
    print("Received v2 scene description request")
    if request.question:
        import base64
        text = gemini_client.describe_scene(request.image, request.question)
        if text:
            return {"description": text, "source": "vlm-qa"}
    result = ai_engine.describe_image_v2(request.image)
    return result

@app.post("/api/simplify")
async def simplify_text_endpoint(request: SimplifyRequest):
    """GenAI plain-language rewrite for dyslexia/aphasia readers."""
    print("Received simplify request")
    if not gemini_client.is_available():
        return {"simplified": None, "error": "GEMINI_API_KEY not configured"}
    simplified = gemini_client.simplify_text(request.text, request.reading_level)
    if simplified is None:
        return {"simplified": None, "error": "Simplification failed"}
    return {"simplified": simplified}

@app.post("/api/depth")
async def estimate_depth(request: ImageRequest):
    """Nearest-obstacle direction + proximity from monocular depth."""
    result = depth_engine.estimate(request.image)
    if result is None:
        return {"available": False}
    return {"available": True, **result}

@app.websocket("/ws/air-writing")
async def websocket_endpoint(websocket: WebSocket):
    print("New WebSocket connection request received.")
    await websocket.accept()
    print("WebSocket connection accepted.")
    if not air_system.is_running:
        print("Camera loop not running, starting it now...")
        t = threading.Thread(target=air_system.start_camera_loop)
        t.daemon = True
        t.start()
    else:
        print("Camera loop already running.")
    
    async def sender():
        try:
            while True:
                if air_system.latest_payload:
                    await websocket.send_json(air_system.latest_payload)
                await asyncio.sleep(0.033)
        except Exception as e:
            print(f"Sender error: {e}")

    async def receiver():
        try:
            while True:
                data = await websocket.receive_text()
                print(f"Received from client: {data}")
                if data == "clear":
                    print("Clearing points...")
                    air_system.clear_points()
                elif data == "restart_camera":
                    print("Restarting camera requested...")
                    if air_system.is_running:
                        print("Forcing old camera loop to stop...")
                        air_system.is_running = False
                        await asyncio.sleep(1) # Give it time to release
                    
                    print("Starting new camera thread...")
                    t = threading.Thread(target=air_system.start_camera_loop)
                    t.daemon = True
                    t.start()
        except Exception as e:
            print(f"Receiver error: {e}")

    await asyncio.gather(sender(), receiver())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
