from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import Dict, Optional
import logging
from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.sdp import candidate_from_sdp
from aiortc.mediastreams import MediaStreamTrack
from ultralytics import YOLO
from PIL import Image
import os

router = APIRouter()
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

STUN_SERVER = RTCConfiguration([
    RTCIceServer(urls="stun:stun.l.google.com:19302")
])

MODEL_PATH = os.path.join(os.path.dirname(__file__), '..', 'yolov8n.pt')
yolo_model = YOLO(MODEL_PATH)

FRUIT_RELABEL = {"ORANGE", "BALL", "GRAPE", "SPORTS BALL"}

class YOLOv8DetectionTrack(MediaStreamTrack):
    kind = "video"

    def __init__(self, track, ws):
        super().__init__()
        self.track = track
        self.ws = ws
        self.frame_skip = 3
        self._counter = 0

    async def recv(self):
        frame = await self.track.recv()
        self._counter += 1

        if self._counter % self.frame_skip != 0:
            return frame

        try:
            img_np = frame.to_ndarray(format="rgb24")
            image = Image.fromarray(img_np)
            results = yolo_model.predict(source=image, conf=0.25, verbose=False, imgsz=480)

            detections = []
            for r in results:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(float, box.xyxy[0])
                    conf = float(box.conf[0])
                    cls_id = int(box.cls[0])
                    original_label = yolo_model.names[cls_id]
                    final_label = "apple" if original_label.upper() in FRUIT_RELABEL else original_label

                    detections.append({
                        "label": final_label,
                        "confidence": conf,
                        "x1": x1, "y1": y1, "x2": x2, "y2": y2
                    })

            if self.ws and detections:
                await self.ws.send_json({"type": "detection_result", "detections": detections})

        except Exception as e:
            logging.error(f"YOLOv8 frame error: {e}")

        return frame


class Room:
    def __init__(self):
        self.broadcaster_pc: Optional[RTCPeerConnection] = None
        self.viewer_connections: Dict[str, Dict] = {}
        self.video_track: Optional[MediaStreamTrack] = None

    async def close(self):
        if self.broadcaster_pc: await self.broadcaster_pc.close()
        for conn in self.viewer_connections.values(): await conn["pc"].close()
        self.viewer_connections.clear()

rooms: Dict[str, Room] = {}

@router.websocket("/ws/{room_name}/{client_id}")
async def websocket_endpoint(websocket: WebSocket, room_name: str, client_id: str):
    await websocket.accept()
    logging.info(f"Client '{client_id}' connected to room '{room_name}'.")

    if room_name not in rooms: rooms[room_name] = Room()
    room = rooms[room_name]

    is_broadcaster = False
    pc: Optional[RTCPeerConnection] = None

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            if msg_type == "offer":
                is_broadcaster = True
                pc = RTCPeerConnection(STUN_SERVER)
                room.broadcaster_pc = pc

                @pc.on("track")
                async def on_track(track):
                    if track.kind == "video":
                        logging.info(f"Received Video Track for room '{room_name}'")
                        room.video_track = track

                        yolo_track = YOLOv8DetectionTrack(track, websocket)

                        for viewer_id, conn in room.viewer_connections.items():
                            try:
                                viewer_pc = conn["pc"]
                                viewer_ws = conn["ws"]
                                viewer_pc.addTrack(track)
                                offer = await viewer_pc.createOffer()
                                await viewer_pc.setLocalDescription(offer)
                                await viewer_ws.send_json({"type": "offer", "sdp": viewer_pc.localDescription.__dict__})
                            except Exception as e:
                                logging.error(f"Error sending offer to viewer '{viewer_id}': {e}")

                await pc.setRemoteDescription(RTCSessionDescription(**data["sdp"]))
                answer = await pc.createAnswer()
                await pc.setLocalDescription(answer)
                await websocket.send_json({"type": "answer", "sdp": pc.localDescription.__dict__})

            elif msg_type == "join_as_viewer":
                pc = RTCPeerConnection(STUN_SERVER)
                room.viewer_connections[client_id] = {"pc": pc, "ws": websocket}

                if room.video_track:
                    pc.addTrack(room.video_track)
                    offer = await pc.createOffer()
                    await pc.setLocalDescription(offer)
                    await websocket.send_json({"type": "offer", "sdp": pc.localDescription.__dict__})
                else:
                    logging.info(f"Viewer '{client_id}' waiting for broadcaster...")

            elif msg_type == "answer":
                if client_id in room.viewer_connections:
                    viewer_pc = room.viewer_connections[client_id]["pc"]
                    await viewer_pc.setRemoteDescription(RTCSessionDescription(**data["sdp"]))

            elif msg_type == "candidate" and data.get("candidate"):
                pc_to_update = None
                if is_broadcaster:
                    pc_to_update = room.broadcaster_pc
                elif client_id in room.viewer_connections:
                    pc_to_update = room.viewer_connections[client_id]["pc"]

                if pc_to_update:
                    try:
                        cand_data = data["candidate"]
                        if isinstance(cand_data, dict):
                            cand = candidate_from_sdp(cand_data['candidate'].split(":", 1)[1])
                            cand.sdpMid = cand_data['sdpMid']
                            cand.sdpMLineIndex = cand_data['sdpMLineIndex']
                            await pc_to_update.addIceCandidate(cand)
                        elif isinstance(cand_data, str):
                            cand = candidate_from_sdp(cand_data.split(":", 1)[1])
                            await pc_to_update.addIceCandidate(cand)
                    except Exception as e:
                        logging.warning(f"Error adding ICE candidate: {e}")

    except WebSocketDisconnect:
        logging.info(f"Client '{client_id}' disconnected.")
    finally:
        if room_name in rooms:
            if is_broadcaster:
                await rooms[room_name].close()
                if room_name in rooms: del rooms[room_name]
            elif client_id in rooms[room_name].viewer_connections:
                conn = rooms[room_name].viewer_connections.pop(client_id)
                await conn["pc"].close()


