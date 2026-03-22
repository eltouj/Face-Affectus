import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
from functions.model_emotion_classifier import EmotionClassifier
import os
import time

def train_continuation(epochs=10, learning_rate=0.0001):
    # 1. Setup Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # 2. Load Model & Weights
    model = EmotionClassifier()
    weights_path = 'weights/resnet_best.pth'
    
    if os.path.exists(weights_path):
        print(f"Loading existing weights from {weights_path}...")
        model.load_state_dict(torch.load(weights_path, map_location=device))
    else:
        print("No existing weights found. Starting from scratch.")

    model.to(device)

    # 3. Data Transformations with Augmentation
    train_transform = transforms.Compose([
        transforms.Grayscale(),
        transforms.Resize((48, 48)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(10),
        transforms.ToTensor(),
        transforms.Normalize((0.5,), (0.5,))
    ])

    val_transform = transforms.Compose([
        transforms.Grayscale(),
        transforms.Resize((48, 48)),
        transforms.ToTensor(),
        transforms.Normalize((0.5,), (0.5,))
    ])

    # 4. Load Datasets
    train_dir = 'data/train'
    val_dir = 'data/validation'
    
    if not os.path.exists(train_dir) or not os.path.exists(val_dir):
        print("Error: Train or Validation directory not found.")
        return

    train_dataset = datasets.ImageFolder(root=train_dir, transform=train_transform)
    val_dataset = datasets.ImageFolder(root=val_dir, transform=val_transform)

    train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)
    val_loader = DataLoader(val_dataset, batch_size=64, shuffle=False)

    # 5. Loss and Optimizer
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)

    best_acc = 0.0

    # 6. Training Loop
    history = {'train_loss': [], 'train_acc': [], 'val_acc': []}
    print(f"Starting training for {epochs} more epochs...")
    
    for epoch in range(epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0

        for images, labels in train_loader:
            images, labels = images.to(device), labels.to(device)

            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()

            running_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()

        train_acc = 100 * correct / total
        avg_loss = running_loss/len(train_loader)
        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {avg_loss:.4f}, Train Acc: {train_acc:.2f}%")

        # Validation
        model.eval()
        val_correct = 0
        val_total = 0
        with torch.no_grad():
            for images, labels in val_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                val_total += labels.size(0)
                val_correct += predicted.eq(labels).sum().item()

        val_acc = 100 * val_correct / val_total
        print(f"Validation Acc: {val_acc:.2f}%")

        # Track history
        history['train_loss'].append(avg_loss)
        history['train_acc'].append(train_acc)
        history['val_acc'].append(val_acc)

        # Save Best Model
        if val_acc > best_acc:
            best_acc = val_acc
            print(f"Saving best model with accuracy: {best_acc:.2f}%")
            if not os.path.exists('weights'):
                os.makedirs('weights')
            torch.save(model.state_dict(), weights_path)

    # 7. Plot Results
    import matplotlib.pyplot as plt
    plt.figure(figsize=(12, 5))
    
    plt.subplot(1, 2, 1)
    plt.plot(history['train_acc'], label='Train Acc')
    plt.plot(history['val_acc'], label='Val Acc')
    plt.title('Accuracy over Epochs')
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(history['train_loss'], label='Train Loss')
    plt.title('Loss over Epochs')
    plt.legend()

    plt.savefig('training_progress.png')
    print("Training finished! Progress plot saved as 'training_progress.png'")

if __name__ == "__main__":
    train_continuation(epochs=10)
