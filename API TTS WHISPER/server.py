from fastapi import FastAPI, Query, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import soundfile as sf
from kokoro import KPipeline
from faster_whisper import WhisperModel
import uuid
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

pipeline = KPipeline(lang_code='f')

whisper_model = WhisperModel("large-v2")

@app.get("/tts")
def generate_tts(text: str = Query(..., title="Texte à convertir")):
    filename = f"tts_output_{uuid.uuid4().hex}.wav"
    generator = pipeline(text, voice='am_michael')

    for _, _, audio in generator:
        sf.write(filename, audio, 24000)
        return FileResponse(filename, media_type="audio/wav", filename=filename)

    return {"error": "Impossible de générer l'audio"}

@app.post("/whisper")
def transcribe_audio(file: UploadFile = File(...)):
    try:
        file_location = f"temp_{uuid.uuid4().hex}.wav"
        with open(file_location, "wb") as buffer:
            buffer.write(file.file.read())

        segments, _ = whisper_model.transcribe(file_location)
        transcription = " ".join(segment.text for segment in segments)
        os.remove(file_location)

        return JSONResponse(content={"transcription": transcription})
    except Exception as e:
        return JSONResponse(content={"error": str(e)}, status_code=500)
