from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.api.v1.router import api_v1_router
from app.services.analysis_service import analysis_service

def create_app() -> FastAPI:
    application = FastAPI(
        title=settings.PROJECT_NAME,
        version=settings.VERSION,
        description="Clean, modular, checkpoint-driven backend for HEVC codec data flow analysis"
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # V1 API
    application.include_router(api_v1_router, prefix=settings.API_V1_STR)

    # Health Check
    @application.get("/health", tags=["Health"])
    async def health_check():
        return {
            "status": "healthy",
            "version": settings.VERSION,
            "encoder_bin": str(settings.ENCODER_BIN),
            "encoder_bin_exists": settings.ENCODER_BIN.exists()
        }

    # Backward compatibility endpoint for existing React frontend App.jsx
    @application.post("/upload", tags=["Legacy Compatibility"])
    async def legacy_upload(
        file: UploadFile = File(...),
        ctu_x: int = Form(0),
        ctu_y: int = Form(0),
        cu_size: int = Form(8),
        scale_mode: str = Form("native")
    ):
        try:
            content = await file.read()
            response = await analysis_service.run_synchronous_analysis(
                image_bytes=content,
                ctu_x=ctu_x,
                ctu_y=ctu_y,
                cu_size=cu_size,
                scale_mode=scale_mode
            )
            return response.model_dump()
        except Exception as e:
            return {"status": "error", "message": str(e)}

    return application

app = create_app()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
