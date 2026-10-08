"""Monocular depth estimation (MiDaS) for obstacle proximity warnings.

The model is downloaded lazily via torch.hub on first use (~large). If the hub
download or inference fails for any reason, every method returns None and the
feature reports itself unavailable, so the rest of the suite keeps working.
"""
import base64
import io

import numpy as np
import torch
from PIL import Image


class DepthEngine:
    def __init__(self):
        self.model = None
        self.transform = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self._load_failed = False

    def _load(self):
        if self.model is not None or self._load_failed:
            return self.model is not None
        try:
            print("[depth] Loading MiDaS via torch.hub (first run downloads weights)...")
            self.model = torch.hub.load(
                "intel-isl/MiDaS", "MiDaS_small", trust_repo=True
            )
            self.model.to(self.device).eval()
            midas_transforms = torch.hub.load("intel-isl/MiDaS", "transforms", trust_repo=True)
            self.transform = midas_transforms.small_transform
            print("[depth] MiDaS ready on", self.device)
            return True
        except Exception as e:
            print(f"[depth] MiDaS load failed (feature disabled): {e}")
            self._load_failed = True
            return False

    def is_available(self) -> bool:
        return self.model is not None

    def _decode(self, base64_image):
        data = base64_image.split(",", 1)[1] if "," in base64_image else base64_image
        return Image.open(io.BytesIO(base64.b64decode(data))).convert("RGB")

    def estimate(self, base64_image: str):
        """Return nearest-obstacle info: {direction, proximity 0..1, depth_map shape}."""
        if not self._load():
            return None
        try:
            image = self._decode(base64_image)
            batch = self.transform(np.array(image)).to(self.device)
            with torch.no_grad():
                prediction = self.model(batch)
                prediction = torch.nn.functional.interpolate(
                    prediction.unsqueeze(1),
                    size=image.size[::-1],  # (h, w)
                    mode="bicubic",
                    align_corners=False,
                ).squeeze().cpu().numpy()

            # MiDaS outputs inverse depth (larger == nearer). Normalize 0..1.
            dmin, dmax = float(prediction.min()), float(prediction.max())
            norm = (prediction - dmin) / (dmax - dmin + 1e-8)

            h, w = norm.shape
            # Focus on the central band where obstacles in front of the user appear.
            band = norm[int(h * 0.35): h, :]
            proximity = float(np.percentile(band, 98))  # nearest significant point

            # Weighted centroid (columns) of the nearest region -> left/right.
            thresh = np.percentile(band, 95)
            mask = band >= thresh
            if mask.any():
                cols = np.where(mask.any(axis=0))[0]
                center = float(cols.mean()) / band.shape[1]
            else:
                center = 0.5

            if center < 0.38:
                direction = "left"
            elif center > 0.62:
                direction = "right"
            else:
                direction = "ahead"

            return {"direction": direction, "proximity": proximity, "center": center}
        except Exception as e:
            print(f"[depth] estimate error: {e}")
            return None
