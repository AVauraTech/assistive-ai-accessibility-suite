import mediapipe as mp
import os
import sys

print(f"MediaPipe location: {mp.__file__}")
print(f"Dir(mp): {dir(mp)}")
try:
    print(f"mp.solutions: {mp.solutions}")
except AttributeError as e:
    print(f"Error accessing solutions: {e}")

try:
    import mediapipe.python.solutions as solutions
    print("Direct import of mediapipe.python.solutions worked")
except ImportError as e:
    print(f"Direct import failed: {e}")
