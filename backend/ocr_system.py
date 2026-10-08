import easyocr
import numpy as np
import cv2
import base64

class OCRSystem:
    def __init__(self):
        self.reader = None

    def _get_reader(self):
        if self.reader is None:
            print("Loading EasyOCR models (this may take a few seconds)...")
            self.reader = easyocr.Reader(['en'])
        return self.reader

    def recognize_base64(self, base64_image):
        """
        Receives a base64 string, converts to image, and runs OCR.
        """
        try:
            reader = self._get_reader()
            # Decode base64 string
            img_data = base64.b64decode(base64_image.split(',')[1] if ',' in base64_image else base64_image)
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if img is None:
                return "Error: Could not decode image"

            # Run EasyOCR
            results = reader.readtext(img, detail=0)
            
            return " ".join(results) if results else ""
        except Exception as e:
            return f"OCR Error: {str(e)}"
