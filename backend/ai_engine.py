import torch
from torchvision import models, transforms
from PIL import Image
import io
import base64
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.lsa import LsaSummarizer
import nltk

class AIEngine:
    def __init__(self):
        self.vision_model = None
        self.COCO_INSTANCE_CATEGORY_NAMES = [
            '__background__', 'person', 'bicycle', 'car', 'motorcycle', 'airplane', 'bus',
            'train', 'truck', 'boat', 'traffic light', 'fire hydrant', 'N/A', 'stop sign',
            'parking meter', 'bench', 'bird', 'cat', 'dog', 'horse', 'sheep', 'cow',
            'elephant', 'bear', 'zebra', 'giraffe', 'N/A', 'backpack', 'umbrella', 'N/A', 'N/A',
            'handbag', 'tie', 'suitcase', 'frisbee', 'skis', 'snowboard', 'sports ball',
            'kite', 'baseball bat', 'baseball glove', 'skateboard', 'surfboard', 'tennis racket',
            'bottle', 'N/A', 'wine glass', 'cup', 'fork', 'knife', 'spoon', 'bowl',
            'banana', 'apple', 'sandwich', 'orange', 'broccoli', 'carrot', 'hot dog', 'pizza',
            'donut', 'cake', 'chair', 'couch', 'potted plant', 'bed', 'N/A', 'dining table',
            'N/A', 'N/A', 'toilet', 'N/A', 'tv', 'laptop', 'mouse', 'remote', 'keyboard', 'cell phone',
            'microwave', 'oven', 'toaster', 'sink', 'refrigerator', 'N/A', 'book',
            'clock', 'vase', 'scissors', 'teddy bear', 'hair drier', 'toothbrush'
        ]

    def _get_vision_model(self):
        if self.vision_model is None:
            print("Loading Vision AI models (SSDLite MobileNetV3)...")
            self.vision_model = models.detection.ssdlite320_mobilenet_v3_large(weights='DEFAULT')
            self.vision_model.eval()
        return self.vision_model

    def _setup_nltk(self):
        try:
            nltk.download('punkt', quiet=True)
            nltk.download('punkt_tab', quiet=True)
        except:
            pass

    def summarize_text(self, text, sentences_count=3):
        try:
            self._setup_nltk()
            parser = PlaintextParser.from_string(text, Tokenizer("english"))
            summarizer = LsaSummarizer()
            summary = summarizer(parser.document, sentences_count)
            return " ".join([str(sentence) for sentence in summary])
        except Exception as e:
            return f"Summarization Error: {str(e)}"

    def describe_image(self, base64_image):
        try:
            # Decode image
            img_data = base64.b64decode(base64_image.split(',')[1] if ',' in base64_image else base64_image)
            image = Image.open(io.BytesIO(img_data)).convert("RGB")
            
            # Transform
            transform = transforms.Compose([transforms.ToTensor()])
            img_t = transform(image)
            batch_t = torch.unsqueeze(img_t, 0)
            
            # Detect
            model = self._get_vision_model()
            with torch.no_grad():
                prediction = model(batch_t)
            
            # Process results
            labels = prediction[0]['labels'].numpy()
            scores = prediction[0]['scores'].numpy()
            
            detected_objects = []
            for i in range(len(scores)):
                if scores[i] > 0.5:
                    label_name = self.COCO_INSTANCE_CATEGORY_NAMES[labels[i]]
                    if label_name not in detected_objects:
                        detected_objects.append(label_name)
            
            if not detected_objects:
                return "I see a neutral background, but no specific objects identified."
            
            return "I see the following objects: " + ", ".join(detected_objects) + "."
        except Exception as e:
            return f"Vision Error: {str(e)}"

    def _decode_image(self, base64_image):
        img_data = base64.b64decode(base64_image.split(',')[1] if ',' in base64_image else base64_image)
        return Image.open(io.BytesIO(img_data)).convert("RGB")

    def describe_image_v2(self, base64_image):
        """v2.0 spatial scene description.

        Tries the Gemini VLM first (rich, contextual, spoken-friendly). If no API
        key is configured or the call fails, falls back to a local SSDLite pass
        that turns bounding boxes into spoken spatial cues ('cup on your right,
        close by'). Always returns a dict the frontend can speak and render.
        """
        # 1) Cloud VLM
        try:
            import gemini_client
            if gemini_client.is_available():
                vlm_text = gemini_client.describe_scene(base64_image)
                if vlm_text:
                    return {"description": vlm_text, "source": "vlm"}
        except Exception as e:
            print(f"VLM describe failed, falling back: {e}")

        # 2) Local spatial fallback from bounding boxes
        try:
            image = self._decode_image(base64_image)
            w, h = image.size
            transform = transforms.Compose([transforms.ToTensor()])
            batch_t = torch.unsqueeze(transform(image), 0)
            model = self._get_vision_model()
            with torch.no_grad():
                prediction = model(batch_t)

            labels = prediction[0]['labels'].numpy()
            scores = prediction[0]['scores'].numpy()
            boxes = prediction[0]['boxes'].numpy()  # x1, y1, x2, y2

            seen = {}
            for i in range(len(scores)):
                if scores[i] <= 0.5:
                    continue
                name = self.COCO_INSTANCE_CATEGORY_NAMES[labels[i]]
                if name == 'N/A':
                    continue
                x1, y1, x2, y2 = boxes[i]
                cx = (x1 + x2) / 2.0 / w
                area = ((x2 - x1) * (y2 - y1)) / float(w * h)
                # Keep the most confident instance per label.
                if name not in seen or scores[i] > seen[name]['score']:
                    seen[name] = {'score': float(scores[i]), 'cx': float(cx), 'area': float(area)}

            if not seen:
                return {
                    "description": "I see a neutral background, but no specific objects identified.",
                    "source": "ssdlite",
                    "objects": [],
                }

            phrases = []
            objects = []
            for name, info in sorted(seen.items(), key=lambda kv: kv[1]['area'], reverse=True):
                if info['cx'] < 0.38:
                    pos = "on your left"
                elif info['cx'] > 0.62:
                    pos = "on your right"
                else:
                    pos = "ahead of you"
                near = "close by" if info['area'] > 0.12 else ("in the distance" if info['area'] < 0.02 else "nearby")
                phrases.append(f"a {name} {pos}, {near}")
                objects.append({"label": name, "position": pos, "proximity": near,
                                "confidence": round(info['score'], 2)})

            description = "I see " + "; ".join(phrases) + "."
            return {"description": description, "source": "ssdlite", "objects": objects}
        except Exception as e:
            return {"description": f"Vision Error: {str(e)}", "source": "error"}
