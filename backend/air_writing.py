import cv2
import mediapipe as mp
import numpy as np
import asyncio
import json
import threading

class AirWritingSystem:
    def __init__(self):
        self.mp_hands = mp.solutions.hands
        self.hands = self.mp_hands.Hands(min_detection_confidence=0.7, min_tracking_confidence=0.5)
        self.mp_draw = mp.solutions.drawing_utils
        self.is_running = False
        self.points = [[]] # List of strokes
        self.current_stroke = 0
        self.current_gesture = "None"
        self.latest_payload = None
        self.lock = threading.Lock()
        # Smoothing variables
        self.smooth_x = 0
        self.smooth_y = 0
        self.alpha = 0.5 # Smoothing factor (0 to 1, higher = less smooth/more responsive)

    def clear_points(self):
        self.points.clear()
        self.points.append([])
        self.current_stroke = 0
        self.smooth_x = 0
        self.smooth_y = 0
        # Force payload update so the client sees empty canvas immediately
        if self.latest_payload:
            self.latest_payload["strokes"] = self.points
            self.latest_payload["is_writing"] = False

    def start_camera_loop(self):
        if not self.lock.acquire(blocking=False):
            print("Camera loop already running.")
            return

        print("Starting camera loop thread...")
        self.is_running = True
        cap = cv2.VideoCapture(0)
        
        try:
            if not cap.isOpened():
                print("Error: Could not open webcam (index 0).")
                return

            print("Webcam successfully opened. Window should appear shortly.")
            window_name = "Air Writing - Backend View"
            
            while self.is_running and cap.isOpened():
                ret, frame = cap.read()
                if not ret:
                    print("Error: Failed to grab frame from camera.")
                    break
                    
                frame = cv2.flip(frame, 1)
                h, w, c = frame.shape
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = self.hands.process(rgb_frame)

                current_payload = {
                    "strokes": self.points,
                    "current_x": 0,
                    "current_y": 0,
                    "is_writing": False
                }

                if result.multi_hand_landmarks:
                    for hand_landmarks in result.multi_hand_landmarks:
                        self.mp_draw.draw_landmarks(frame, hand_landmarks, self.mp_hands.HAND_CONNECTIONS)
                        
                        # Finger tips
                        tips = [8, 12, 16, 20]
                        pips = [6, 10, 14, 18]
                        up_fingers = [hand_landmarks.landmark[t].y < hand_landmarks.landmark[p].y for t, p in zip(tips, pips)]
                        
                        # Simple Gesture Logic
                        if sum(up_fingers) == 0:
                            self.current_gesture = "Fist"
                        elif sum(up_fingers) == 4:
                            self.current_gesture = "Open Palm"
                        elif up_fingers[0] and up_fingers[1] and not up_fingers[2] and not up_fingers[3]:
                            self.current_gesture = "Victory"
                        else:
                            self.current_gesture = "Pointing"

                        idx_tip = hand_landmarks.landmark[8]
                        idx_pip = hand_landmarks.landmark[6]
                        
                        raw_x, raw_y = int(idx_tip.x * w), int(idx_tip.y * h)
                        
                        if self.smooth_x == 0 and self.smooth_y == 0:
                            self.smooth_x, self.smooth_y = raw_x, raw_y
                        else:
                            self.smooth_x = int(self.alpha * raw_x + (1 - self.alpha) * self.smooth_x)
                            self.smooth_y = int(self.alpha * raw_y + (1 - self.alpha) * self.smooth_y)
                        
                        cx, cy = self.smooth_x, self.smooth_y
                        is_writing = idx_tip.y < idx_pip.y
                        
                        if is_writing:
                            if len(self.points[self.current_stroke]) > 0:
                                last_point = self.points[self.current_stroke][-1]
                                if np.hypot(cx - last_point[0], cy - last_point[1]) > 5:
                                    self.points[self.current_stroke].append((cx, cy))
                            else:
                                self.points[self.current_stroke].append((cx, cy))
                        else:
                            if len(self.points[self.current_stroke]) > 0:
                                self.points.append([])
                                self.current_stroke += 1

                        cv2.circle(frame, (cx, cy), 10, (0, 255, 0) if is_writing else (0, 0, 255), cv2.FILLED)
                        cv2.putText(frame, f"Gesture: {self.current_gesture}", (10, 50), cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 0), 2)
                        
                        current_payload["current_x"] = cx
                        current_payload["current_y"] = cy
                        current_payload["is_writing"] = is_writing
                        current_payload["gesture"] = self.current_gesture

                try:
                    cv2.imshow(window_name, frame)
                except Exception as e:
                    print(f"OpenCV Error showing window: {e}")
                
                self.latest_payload = current_payload
                
                # Use a slightly longer waitKey to give GUI more time
                if cv2.waitKey(20) & 0xFF == ord('q'):
                    print("User pressed 'q' - stopping camera.")
                    break
        except Exception as e:
            print(f"Error in camera loop: {e}")
        finally:
            cap.release()
            try:
                cv2.destroyAllWindows()
            except:
                pass
            self.is_running = False
            self.lock.release()
            print("Camera loop thread exited cleanly.")

# We need to fix the broadcasting.
# Let's add a broadcast method that main.py can call, OR make this async friendly.
# Since cv2 is blocking, it's best in a thread.
# We will pass the latest coordinates to a shared variable, and the websocket loop will poll it?
# Or use an asyncio loop in a separate thread.
