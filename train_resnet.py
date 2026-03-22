import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
from functions.model_emotion_classifier import EmotionClassifier
import os
import matplotlib.pyplot as plt

def train_resnet(epochs=20, learning_rate=0.001):
    # 1. Setup Device
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    # 2. Initialize New Model (ResNet-18)
    model = EmotionClassifier(num_classes=7)
    model.to(device)

    # 3. Data Transformations with Heavy Augmentation for deeper net
    train_transform = transforms.Compose([
        transforms.Grayscale(),
        transforms.Resize((48, 48)),
        transforms.RandomHorizontalFlip(),
        transforms.RandomRotation(15),
        transforms.RandomAffine(0, shear=10, scale=(0.8,1.2)),
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

    # --- Add Weighted Sampling to handle imbalance ---
    from torch.utils.data import WeightedRandomSampler
    import numpy as np

    # Get class counts
    class_counts = [len([f for f in os.listdir(os.path.join(train_dir, c))]) for c in train_dataset.classes]
    num_samples = sum(class_counts)
    
    # Compute weight for each class
    # We use a power factor (0.5) to "smoothen" the weights, 
    # so we don't over-sample rare classes too aggressively at the expense of common ones.
    class_weights = [(num_samples / count) ** 0.5 for count in class_counts]
    
    # Assign weight to each sample in the dataset
    sample_weights = [class_weights[label] for _, label in train_dataset.samples]
    
    # Create the sampler
    sampler = WeightedRandomSampler(weights=sample_weights, num_samples=num_samples, replacement=True)

    # Update DataLoader to use the sampler
    train_loader = DataLoader(train_dataset, batch_size=64, sampler=sampler)
    val_loader = DataLoader(val_dataset, batch_size=128, shuffle=False)

    # 5. Loss, Optimizer, and Scheduler
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=learning_rate)
    scheduler = optim.lr_scheduler.ReduceLROnPlateau(optimizer, mode='max', factor=0.5, patience=2)

    best_acc = 0.0
    history = {'train_loss': [], 'train_acc': [], 'val_acc': []}
    weights_path = 'weights/resnet_best.pth'

    # 6. Training Loop
    print(f"Starting ResNet-18 training for {epochs} epochs...")
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
        print(f"Epoch [{epoch+1}/{epochs}] - Loss: {avg_loss:.4f}, Train Acc: {train_acc:.2f}%, Val Acc: {val_acc:.2f}%")

        # Track history
        history['train_loss'].append(avg_loss)
        history['train_acc'].append(train_acc)
        history['val_acc'].append(val_acc)
        
        # Adjust LR based on validation accuracy
        scheduler.step(val_acc)

        # Save Best Model
        if val_acc > best_acc:
            best_acc = val_acc
            print(f"--> Saving new best ResNet model: {best_acc:.2f}%")
            if not os.path.exists('weights'):
                os.makedirs('weights')
            torch.save(model.state_dict(), weights_path)

    # 7. Plot Results
    plt.figure(figsize=(12, 5))
    plt.subplot(1, 2, 1)
    plt.plot(history['train_acc'], label='Train Acc')
    plt.plot(history['val_acc'], label='Val Acc')
    plt.title('ResNet Accuracy')
    plt.legend()

    plt.subplot(1, 2, 2)
    plt.plot(history['train_loss'], label='Train Loss')
    plt.title('ResNet Loss')
    plt.legend()

    plt.savefig('resnet_training_progress.png')
    print("ResNet training finished! Plot saved as 'resnet_training_progress.png'")

if __name__ == "__main__":
    train_resnet(epochs=15)
