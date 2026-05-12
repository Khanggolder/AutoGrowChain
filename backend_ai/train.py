from ultralytics import YOLO

print("Starting YOLOv8 Training for AutoGrowChain...")

model = YOLO("yolov8n.pt")
model.train(
    data="dataset.yaml",
    epochs=50,
    imgsz=640,
    batch=16,
    name="autogrowchain-detect"
)

print("Training complete!")
print("Best model: runs/detect/autogrowchain-detect/weights/best.pt")


