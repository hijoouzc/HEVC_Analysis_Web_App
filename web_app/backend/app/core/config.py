import os
from pathlib import Path
from pydantic import BaseModel, Field

class Settings(BaseModel):
    PROJECT_NAME: str = "HEVC Data-Flow Analysis Tool"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api/v1"
    
    # Path configuration
    PROJECT_ROOT: Path = Path(os.environ.get("HEVC_PROJECT_ROOT", Path(__file__).resolve().parents[4])).resolve()
    
    @property
    def WORKSPACE_DIR(self) -> Path:
        return self.PROJECT_ROOT / "workspace"
        
    @property
    def SESSIONS_DIR(self) -> Path:
        return self.WORKSPACE_DIR / "sessions"
        
    @property
    def LEGACY_TEMP_DIR(self) -> Path:
        return self.WORKSPACE_DIR / "temp"
        
    @property
    def LEGACY_DUMP_DIR(self) -> Path:
        return self.PROJECT_ROOT / "dump_data"
        
    @property
    def ENCODER_BIN(self) -> Path:
        # 1. Release compiled path (Optimized with -O3 for high performance)
        release_path = self.PROJECT_ROOT / "bin/umake/gcc-13.3/x86_64/release/TAppEncoder"
        if release_path.exists() and not os.environ.get("HEVC_FORCE_DEBUG"):
            return release_path

        # 2. Environment variable override
        env_bin = os.environ.get("HEVC_ENCODER_BIN")
        if env_bin and Path(env_bin).exists():
            return Path(env_bin).resolve()

        # 3. Debug compiled path
        debug_path = self.PROJECT_ROOT / "bin/umake/gcc-13.3/x86_64/debug/TAppEncoder"
        if debug_path.exists():
            return debug_path
            
        # 3. Known alternative paths
        candidates = [
            self.PROJECT_ROOT / "bin/TAppEncoderStatic",
            self.PROJECT_ROOT / "bin/TAppEncoder",
        ]
        for cand in candidates:
            if cand.exists():
                return cand

        # 4. Search bin/ directory dynamically
        bin_dir = self.PROJECT_ROOT / "bin"
        if bin_dir.exists():
            matches = [p for p in bin_dir.glob("**/TAppEncoder") if p.is_file() and os.access(p, os.X_OK)]
            if matches:
                return matches[0]

        return release_path
        
    @property
    def DEFAULT_CFG(self) -> Path:
        return self.PROJECT_ROOT / "cfg/encoder_intra_main.cfg"
        
    # Encoder defaults
    CTU_SIZE: int = 64
    DEFAULT_CU_SIZE: int = 8
    DEFAULT_FPS: int = 50
    DEFAULT_FRAMES: int = 1
    
    # CORS
    CORS_ORIGINS: list[str] = ["*"]

settings = Settings()
