import cv2
import time

def test_camera():
    print("Attempting to open camera index 0...")
    cap = cv2.VideoCapture(0)
    
    if not cap.isOpened():
        print("Error: Could not open webcam index 0.")
        return

    print("Webcam opened successfully. Showing window for 5 seconds...")
    print("Press 'q' in the window to exit early.")
    
    start_time = time.time()
    try:
        while time.time() - start_time < 10: # Increased to 10s for better visibility
            ret, frame = cap.read()
            if not ret:
                print("Error: Could not read frame.")
                break
            
            cv2.imshow("TEST WINDOW", frame)
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    except Exception as e:
        print(f"An error occurred: {e}")
    finally:
        cap.release()
        cv2.destroyAllWindows()
        print("Test ended.")

if __name__ == "__main__":
    test_camera()
