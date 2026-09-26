from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Data Intelligence Platform", version="1.0")

# Allow your Next.js frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """
    Base endpoint to check if the server is actively running.
    """
    return {
        "status": "online", 
        "message": "FastAPI Backend is running and ready for Next.js"
    }