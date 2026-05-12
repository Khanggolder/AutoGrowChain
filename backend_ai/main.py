import sys
import io
import os
import logging
import datetime
import httpx
import json
import torch
import torch.nn as nn
import numpy as np
import uvicorn
from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from api import webrtc_signaling
from market_crawler import crawl_market_prices


if sys.platform == 'win32':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

app = FastAPI(title="AutoGrowChain AI Backend", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webrtc_signaling.router, prefix="/stream", tags=["WebRTC"])
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DETECT_DIR = os.path.join(BASE_DIR, '..', 'detect')

TOMATO_CLASSES = [
    'background', 'Healthy_Tomato', 'Blossom_End_Rot', 'Late_Blight',
    'Mold', 'Anthracnose', 'Fruit_Cracking', 'Catfaced', 'Spotted_Wilt_Virus'
]

TREATMENT_DB = {
    'Healthy_Tomato': {
        'name': 'Healthy Tomato',
        'severity': 'good',
        'treatment': 'Plant is growing well. Continue current care schedule, maintain regular watering and fertilizing.'
    },
    'Blossom_End_Rot': {
        'name': 'Blossom End Rot',
        'severity': 'medium',
        'treatment': 'Add Calcium (CaCl2 0.5%) foliar spray every 7 days. Maintain stable soil moisture 60-70%. Avoid excess Nitrogen (N).'
    },
    'Late_Blight': {
        'name': 'Late Blight (Phytophthora)',
        'severity': 'critical',
        'treatment': 'Apply copper-based fungicide (Bordeaux 1%) or Mancozeb immediately. Remove and destroy infected leaves. Reduce humidity, increase ventilation.'
    },
    'Mold': {
        'name': 'Leaf Mold',
        'severity': 'high',
        'treatment': 'Apply Trichoderma or bio-fungicide. Improve greenhouse ventilation. Avoid overhead watering in the evening.'
    },
    'Anthracnose': {
        'name': 'Anthracnose',
        'severity': 'high',
        'treatment': 'Apply Chlorothalonil or Azoxystrobin. Harvest ripe fruits early. Sanitize harvesting tools with 70% alcohol.'
    },
    'Fruit_Cracking': {
        'name': 'Fruit Cracking',
        'severity': 'medium',
        'treatment': 'Maintain even watering, avoid sudden irrigation after drought. Mulch the base. Add Potassium (K2SO4) to increase skin strength.'
    },
    'Catfaced': {
        'name': 'Catfacing',
        'severity': 'low',
        'treatment': 'Control greenhouse temperature (avoid below 15°C during flowering). Limit hormone herbicides near planting area.'
    },
    'Spotted_Wilt_Virus': {
        'name': 'Spotted Wilt Virus (TSWV)',
        'severity': 'critical',
        'treatment': 'NO CURE — Uproot infected plants immediately. Control thrips with blue sticky traps + Spinosad. Plant resistant varieties.'
    },
}

_vision_model = None
_vision_device = None

def _load_vision_model():
    global _vision_model, _vision_device
    if _vision_model is not None:
        return _vision_model, _vision_device

    from torchvision.models.detection import fasterrcnn_mobilenet_v3_large_fpn
    from torchvision.models.detection.faster_rcnn import FastRCNNPredictor

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    model = fasterrcnn_mobilenet_v3_large_fpn(weights=None)
    in_features = model.roi_heads.box_predictor.cls_score.in_features
    model.roi_heads.box_predictor = FastRCNNPredictor(in_features, len(TOMATO_CLASSES))

    model_path = os.path.join(DETECT_DIR, 'models', 'tomato', 'best_model.pth')
    checkpoint = torch.load(model_path, map_location=device, weights_only=False)

    if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
        model.load_state_dict(checkpoint['model_state_dict'])
    else:
        model.load_state_dict(checkpoint)

    model.to(device)
    model.eval()
    _vision_model = model
    _vision_device = device
    logging.info(f"Faster R-CNN loaded on {device}")
    return model, device

REPEL_DB = {
    'Achetadomesticus': 22000,
    'Tettigoniacantans': 19000,
    'Tettigoniaviridissima': 18000,
    'Grylluscampestris': 21000,
    'Gryllusbimaculatus': 21500,
    'Conocephalusfuscus': 19500,
    'Conocephalusdorsalis': 19000,
    'Chorthippusbiguttulus': 17000,
    'Chorthippusbrunneus': 17500,
    'Roeselianaroeselii': 18500,
    'Ephippigerdiurnus': 16000,
    'Decticusverrucivorus': 16500,
    'Eumodicogryllusbordigalensis': 20000,
    'Barbitistesyersini': 18000,
}

_audio_model = None
_audio_device = None
_audio_classes = None
_mel_transform = None
_db_transform = None

def _load_audio_model():
    global _audio_model, _audio_device, _audio_classes, _mel_transform, _db_transform
    if _audio_model is not None:
        return _audio_model, _audio_device, _audio_classes

    import torchaudio
    from torchvision import models

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    classes_path = os.path.join(DETECT_DIR, 'models', 'voice', 'classes.npy')
    _audio_classes = np.load(classes_path, allow_pickle=True)

    model = models.resnet18()
    model.conv1 = nn.Conv2d(1, 64, kernel_size=7, stride=2, padding=3, bias=False)
    model.fc = nn.Linear(model.fc.in_features, len(_audio_classes))

    model_path = os.path.join(DETECT_DIR, 'models', 'voice', 'insect_detector.pth')
    model.load_state_dict(torch.load(model_path, map_location=device, weights_only=False))
    model.to(device)
    model.eval()

    _mel_transform = torchaudio.transforms.MelSpectrogram(sample_rate=22050, n_mels=128).to(device)
    _db_transform = torchaudio.transforms.AmplitudeToDB().to(device)

    _audio_model = model
    _audio_device = device
    logging.info(f"ResNet18 insect detector loaded on {device}")
    return model, device, _audio_classes


def _convert_webm_to_wav(audio_bytes: bytes) -> bytes:
    try:
        from pydub import AudioSegment
        audio = AudioSegment.from_file(io.BytesIO(audio_bytes))
        wav_buffer = io.BytesIO()
        audio.export(wav_buffer, format="wav")
        wav_buffer.seek(0)
        return wav_buffer.read()
    except Exception as e:
        logging.warning(f"pydub conversion failed: {e}, trying raw bytes")
        return audio_bytes

@app.get("/api/status")
def read_root():
    return {"status": "running", "version": "2.0.0"}

@app.get("/api/market-prices")
async def get_market_prices():
    try:
        all_prices = await crawl_market_prices()
        

        keywords = ["cà chua", "tomato", "cherry"]
        tomato_prices = [p for p in all_prices if any(k in p.get("product", "").lower() for k in keywords)]
        other_prices = [p for p in all_prices if not any(k in p.get("product", "").lower() for k in keywords)]
        

        sorted_prices = tomato_prices + other_prices[:10]
        
        has_real_data = len(tomato_prices) > 0
        recommendation = "HOLD"
        recommendation_reason = "No tomato-specific price data found."
        
        if has_real_data:

            avg_price = 45000 # default
            try:
                prices_nums = []
                for p in tomato_prices:
                    price_str = p.get("price", "0")

                    digits = ''.join(filter(str.isdigit, price_str))
                    if digits: prices_nums.append(int(digits))
                
                if prices_nums: avg_price = sum(prices_nums) / len(prices_nums)
            except Exception as e:
                logging.error(f"Error calculating avg_price: {e}")
            
            if avg_price > 40000:
                recommendation = "HARVEST_NOW"
                recommendation_reason = f"Current tomato prices (avg {avg_price:,.0f} VND) are in the premium range. Harvest recommended."
            else:
                recommendation = "HOLD"
                recommendation_reason = f"Current prices (avg {avg_price:,.0f} VND) are stable. Wait for peak market value."

        return {
            "prices": sorted_prices,
            "has_real_data": has_real_data,
            "recommendation": recommendation,
            "recommendation_reason": recommendation_reason,
            "crawled_at": datetime.datetime.now().isoformat()
        }
    except Exception as e:
        logging.error(f"FATAL Error in get_market_prices: {e}", exc_info=True)
        return {
            "prices": [],
            "has_real_data": False,
            "recommendation": "ERROR",
            "recommendation_reason": f"Internal Server Error: {str(e)}",
            "crawled_at": datetime.datetime.now().isoformat()
        }


@app.post("/api/vision/analyze")
async def analyze_vision(file: UploadFile = File(...)):
    try:
        from PIL import Image
        import torchvision.transforms.functional as F

        model, device = _load_vision_model()

        contents = await file.read()
        image = Image.open(io.BytesIO(contents)).convert("RGB")

        img_tensor = F.to_tensor(image).to(device)

        with torch.no_grad():
            predictions = model([img_tensor])

        pred = predictions[0]
        boxes = pred['boxes'].cpu().numpy()
        labels = pred['labels'].cpu().numpy()
        scores = pred['scores'].cpu().numpy()

        threshold = 0.3
        mask = scores >= threshold
        boxes = boxes[mask]
        labels = labels[mask]
        scores = scores[mask]

        if len(labels) == 0:
            return {
                "status": "No disease detected",
                "confidence": "0%",
                "treatment": "No clear disease detected. Please take a clearer picture or from a different angle.",
                "detections": [],
                "total_detections": 0
            }

        best_idx = np.argmax(scores)
        best_label_id = int(labels[best_idx])
        best_score = float(scores[best_idx])
        best_class_name = TOMATO_CLASSES[best_label_id] if best_label_id < len(TOMATO_CLASSES) else "Unknown"

        treatment_info = TREATMENT_DB.get(best_class_name, {
            'name': best_class_name,
            'severity': 'unknown',
            'treatment': 'No treatment information available. Please consult an expert.'
        })

        all_detections = []
        for i in range(len(labels)):
            cls_name = TOMATO_CLASSES[int(labels[i])] if int(labels[i]) < len(TOMATO_CLASSES) else "Unknown"
            t_info = TREATMENT_DB.get(cls_name, {'name': cls_name, 'severity': 'unknown', 'treatment': ''})
            all_detections.append({
                "class": cls_name,
                "name": t_info['name'],
                "confidence": f"{float(scores[i]) * 100:.1f}%",
                "severity": t_info['severity'],
                "box": boxes[i].tolist()
            })

        return {
            "status": best_class_name,
            "name": treatment_info['name'],
            "confidence": f"{best_score * 100:.1f}%",
            "severity": treatment_info['severity'],
            "treatment": treatment_info['treatment'],
            "detections": all_detections,
            "total_detections": len(all_detections)
        }

    except Exception as e:
        logging.error(f"[Vision] Error: {e}", exc_info=True)
        return {
            "status": "Error",
            "confidence": "0%",
            "treatment": f"Image processing error: {str(e)}",
            "detections": [],
            "total_detections": 0
        }


@app.post("/api/audio/detect")
async def detect_insect_audio(file: UploadFile = File(...)):
    try:
        import torchaudio

        model, device, classes = _load_audio_model()
        global _mel_transform, _db_transform

        contents = await file.read()
        filename = file.filename or "audio.wav"

        if filename.lower().endswith(('.webm', '.ogg', '.mp4', '.m4a')):
            contents = _convert_webm_to_wav(contents)

        audio_buffer = io.BytesIO(contents)
        try:
            waveform, sr = torchaudio.load(audio_buffer)
        except Exception:
            import soundfile as sf
            audio_buffer.seek(0)
            data, sr = sf.read(audio_buffer)
            waveform = torch.from_numpy(data).float()
            if waveform.ndim == 1:
                waveform = waveform.unsqueeze(0)
            elif waveform.ndim == 2:
                waveform = waveform.T

        if waveform.abs().max() > 1.0:
            waveform = waveform / 32768.0

        if waveform.ndim > 1 and waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)
        if waveform.ndim == 1:
            waveform = waveform.unsqueeze(0)

        if waveform.abs().max() > 0:
            waveform = waveform / waveform.abs().max()

        if sr != 22050:
            resampler = torchaudio.transforms.Resample(sr, 22050).to(device)
            waveform = resampler(waveform.to(device))
        else:
            waveform = waveform.to(device)

        target_samples = 22050 * 5
        if waveform.shape[1] > target_samples:
            waveform = waveform[:, :target_samples]
        elif waveform.shape[1] < target_samples:
            padding = target_samples - waveform.shape[1]
            waveform = torch.nn.functional.pad(waveform, (0, padding))

        with torch.no_grad():
            spec = _mel_transform(waveform)
            spec_db = _db_transform(spec)
            outputs = model(spec_db.unsqueeze(0))
            probs = torch.nn.functional.softmax(outputs, dim=1)
            conf, predicted = torch.max(probs, 1)

            species = str(classes[predicted.item()])
            confidence = float(conf.item())
            repel_hz = REPEL_DB.get(species, 20000)

        display_name = species
        for i in range(1, len(display_name)):
            if display_name[i].isupper() and display_name[i-1].islower():
                display_name = display_name[:i] + ' ' + display_name[i:]
                break

        return {
            "insect": display_name,
            "species_key": species,
            "confidence": f"{confidence * 100:.1f}%",
            "confidence_raw": round(confidence * 100, 2),
            "repel_hz": repel_hz,
            "filename": filename,
            "duration_sec": 5,
            "model": "ResNet18-InsectSet66"
        }

    except Exception as e:
        logging.error(f"[Audio] Error: {e}", exc_info=True)
        return {
            "insect": "Unknown",
            "species_key": "unknown",
            "confidence": "0%",
            "confidence_raw": 0,
            "repel_hz": 20000,
            "error": str(e)
        }

CACHE_STORE = {"strategic_advice": {"data": None, "timestamp": 0}}
CACHE_TTL = 15 * 60  # 15 minutes

@app.get("/api/ai/strategic-advice")
async def strategic_advice():
    import datetime
    import httpx
    import json
    import time

    global CACHE_STORE
    if CACHE_STORE["strategic_advice"]["data"] and (time.time() - CACHE_STORE["strategic_advice"]["timestamp"] < CACHE_TTL):
        cached_data = CACHE_STORE["strategic_advice"]["data"].copy()
        cached_data["is_cached"] = True
        return cached_data

    host = "localhost"
    plants_data = []
    harvests_data = []
    analytics_data = {}
    market_data = []
    sensor_data = {}

    async with httpx.AsyncClient(timeout=5) as client:
        try:
            r = await client.get(f"http://{host}:3010/api/plants")
            if r.status_code == 200: plants_data = r.json()
        except: pass
        try:
            r = await client.get(f"http://{host}:3010/api/harvests")
            if r.status_code == 200: harvests_data = r.json()[:10]
        except: pass
        try:
            r = await client.get(f"http://{host}:3010/api/analytics/summary")
            if r.status_code == 200: analytics_data = r.json()
        except: pass
        try:
            r = await client.get(f"http://{host}:3010/api/sensors/history?limit=1")
            if r.status_code == 200:
                hist = r.json()
                if hist: sensor_data = hist[0]
        except: pass

    try:
        market_data = await crawl_market_prices()
    except: pass

    tomato_prices = [p for p in market_data if "cà chua" in p.get("product","").lower() or "cherry" in p.get("product","").lower() or "tomato" in p.get("product","").lower()]
    price_summary = tomato_prices[:3] if tomato_prices else market_data[:5]

    context = f"""SYSTEM DATA (Real-time from AutoGrowChain Database):
Plants: {json.dumps([{"name":p.get("name",""),"stage":p.get("stage",""),"health":p.get("health",""),"planted":p.get("planted_date","")} for p in plants_data[:5]], ensure_ascii=False)}
Recent Harvests: {json.dumps([{"plant":h.get("plant_name",""),"weight_g":h.get("weight_g",0),"fruits":h.get("fruits_count",0),"date":h.get("harvested_at","")} for h in harvests_data[:5]], ensure_ascii=False)}
Analytics: Total yield={analytics_data.get("total_yield_kg","N/A")}kg, Revenue={analytics_data.get("estimated_revenue","N/A")} VND, Expenses={analytics_data.get("total_expenses","N/A")} VND, Active plants={analytics_data.get("active_plants","N/A")}
Market Prices (crawled live): {json.dumps(price_summary, ensure_ascii=False)}
Latest Sensors: humidity={sensor_data.get("humidity","N/A")}%, pH={sensor_data.get("ph","N/A")}, soil_moisture={sensor_data.get("soil_moisture","N/A")}%
Current date: {datetime.datetime.now().strftime("%Y-%m-%d")}"""

    prompt = f"""{context}

Based on the REAL data above, provide agricultural business advice. You MUST respond in EXACTLY this JSON format (no markdown, no extra text):
{{"harvest_prediction":"<estimate days to next harvest and expected yield based on plant stage and harvest history>","market_advice":"<analyze current market prices for cherry tomatoes and advise whether to sell now or wait>","reinvestment_tip":"<based on current expenses, revenue and plant health, suggest one specific reinvestment action>"}}"""

    GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
    if not GROQ_KEY:
        try:
            from dotenv import load_dotenv
            load_dotenv(os.path.join(BASE_DIR, '..', 'blockchain_server', '.env'))
            GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
        except: pass

    if GROQ_KEY:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {GROQ_KEY}", "Content-Type": "application/json"},
                    json={
                        "model": "llama-3.1-8b-instant",
                        "messages": [
                            {"role": "system", "content": "You are an expert agricultural business advisor. Analyze real farm data and provide actionable advice. Always respond in valid JSON only."},
                            {"role": "user", "content": prompt}
                        ],
                        "temperature": 0.4,
                        "max_tokens": 512
                    }
                )
                if r.status_code == 200:
                    data = r.json()
                    reply = data["choices"][0]["message"]["content"].strip()
                    if reply.startswith("```"): reply = reply.split("\n", 1)[1].rsplit("```", 1)[0].strip()
                    parsed = json.loads(reply)
                    parsed["source"] = "groq_llama3"
                    parsed["generated_at"] = datetime.datetime.now().isoformat()
                    parsed["market_data_used"] = price_summary

                    CACHE_STORE["strategic_advice"]["data"] = parsed
                    CACHE_STORE["strategic_advice"]["timestamp"] = time.time()
                    return parsed
        except Exception as e:
            logging.error(f"[AI Advisor] Groq error: {e}")

    return {
        "harvest_prediction": f"Based on {len(plants_data)} active plants in stages: {', '.join(set(p.get('stage','') for p in plants_data))}. Check AI server logs.",
        "market_advice": f"Market data: {len(market_data)} products crawled. Groq API key required for full analysis.",
        "reinvestment_tip": f"Total expenses: {analytics_data.get('total_expenses','N/A')} VND. Configure GROQ_API_KEY for AI recommendations.",
        "source": "fallback",
        "generated_at": datetime.datetime.now().isoformat()
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)


