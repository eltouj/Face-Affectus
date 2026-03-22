# How to Add Custom Data to the AI

To help your **Face-Affectus AI** learn better, you can add your own images. This is the #1 way to increase real-world accuracy!

## 1. Where to put the images?

- Go to the `data/train/` folder.
- You'll see folders for each emotion: `angry`, `disgust`, `fear`, `happy`, `neutral`, `sad`, `surprise`.
- Simply drop your new images into the folder that matches the emotion!

> [!TIP]
> **Priority Area**: Add images to `disgust`, `surprise`, and `angry` first! These have the least data right now.

## 2. Image Requirements
- **Format**: `.jpg`, `.png`, or `.jpeg`.
- **Content**: A single face clearly showing the emotion.
- **Grayscale/Size**: Don't worry about this—the training script will automatically crop, resize, and convert them to grayscale for you!

## 3. After adding images...
1. Close the dashboard if it's running.
2. Run the training script:
   `.env\Scripts\python.exe train_resnet.py`
3. The AI will immediately start learning from your new data!
