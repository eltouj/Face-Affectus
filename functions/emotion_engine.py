import cv2
import torch
from torchvision.transforms import ToTensor, Compose, Normalize, Grayscale, Resize
from functions.model_emotion_classifier import EmotionClassifier

class EmotionEngine:
    def __init__(self, weights_path='weights/resnet_best.pth'):
        self.class_to_emotion = {
            0: 'angry', 1: 'disgust', 2: 'fear', 3: 'happy', 
            4: 'neutral', 5: 'sad', 6: 'surprise'
        }
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.model = EmotionClassifier()
        
        # Load weights if they exist (will exist after training starts)
        import os
        if os.path.exists(weights_path):
            self.model.load_state_dict(torch.load(weights_path, map_location=self.device))
        
        self.model.to(self.device)
        self.model.eval()
        
        # Transformation pipeline matching the training process
        self.transform = Compose([
            ToTensor(),
            Normalize((0.5,), (0.5,))
        ])
        
        self.face_cascade = cv2.CascadeClassifier(
            cv2.data.haarcascades + 'haarcascade_frontalface_default.xml'
        )

    def process_frame(self, frame):
        """
        Processes a single BGR frame and returns prediction results.
        Returns: (frame_with_annotations, detected_emotions_list)
        """
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        faces = self.face_cascade.detectMultiScale(
            gray, scaleFactor=1.1, minNeighbors=5, minSize=(30, 30)
        )
        
        results = []
        
        for (x, y, w, h) in faces:
            # Extract face from image & convert to tensor with normalization
            face_roi = gray[y:y+h, x:x+w]
            face_roi = cv2.resize(face_roi, (48, 48))
            image = self.transform(face_roi).unsqueeze(0).to(self.device)

            # Make a prediction
            with torch.no_grad():
                output = self.model(image)
                predicted_class = torch.argmax(output, dim=1).item()
                emotion = self.class_to_emotion[predicted_class]
                
            # Data is aggregated in the results list, no visual annotations needed on frame
            results.append({
                'emotion': emotion,
                'box': (int(x), int(y), int(w), int(h))
            })
            
        return frame, results
