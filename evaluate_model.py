import torch
import torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
from functions.model_emotion_classifier import EmotionClassifier
from sklearn.metrics import classification_report, confusion_matrix
import seaborn as sns
import matplotlib.pyplot as plt
import numpy as np
import os

def evaluate():
    # 1. Setup Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # 2. Load Model
    model = EmotionClassifier()
    weights_path = 'weights/resnet_best.pth'
    if not os.path.exists(weights_path):
        weights_path = 'weights/best_emotion_classifier.pth' # Fallback

    model.load_state_dict(torch.load(weights_path, map_location=device))
    model.to(device)
    model.eval()

    # 3. Data Transformation (same as used in training)
    transform = transforms.Compose([
        transforms.Grayscale(),
        transforms.Resize((48, 48)),
        transforms.ToTensor(),
        transforms.Normalize((0.5,), (0.5,))
    ])

    # 4. Load Validation Data
    val_dir = 'data/validation'
    if not os.path.exists(val_dir):
        print(f"Error: Validation directory not found at {val_dir}")
        return

    val_dataset = datasets.ImageFolder(root=val_dir, transform=transform)
    val_loader = DataLoader(val_dataset, batch_size=32, shuffle=False)
    
    class_names = val_dataset.classes
    print(f"Detected classes: {class_names}")

    # 5. Evaluation Loop
    all_preds = []
    all_labels = []

    print("Evaluating model...")
    with torch.no_grad():
        for images, labels in val_loader:
            images, labels = images.to(device), labels.to(device)
            outputs = model(images)
            _, preds = torch.max(outputs, 1)
            
            all_preds.extend(preds.cpu().numpy())
            all_labels.extend(labels.cpu().numpy())

    # 6. Metrics and Reporting
    print("\n--- Classification Report ---")
    print(classification_report(all_labels, all_preds, target_names=class_names))

    # 7. Confusion Matrix
    cm = confusion_matrix(all_labels, all_preds)
    plt.figure(figsize=(10, 8))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=class_names, yticklabels=class_names)
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.title('Confusion Matrix')
    
    # Save the plot
    output_plot = 'evaluation_results.png'
    plt.savefig(output_plot)
    print(f"\nConfusion matrix saved to {output_plot}")
    
    accuracy = 100 * np.sum(np.array(all_preds) == np.array(all_labels)) / len(all_labels)
    print(f"Overall Accuracy: {accuracy:.2f}%")

if __name__ == "__main__":
    evaluate()
