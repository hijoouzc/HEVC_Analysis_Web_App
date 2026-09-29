class HEVCAnalysisError(Exception):
    """Base exception for HEVC analysis backend"""
    pass

class JobNotFoundError(HEVCAnalysisError):
    def __init__(self, job_id: str):
        super().__init__(f"Job '{job_id}' not found.")
        self.job_id = job_id

class EncoderExecutionError(HEVCAnalysisError):
    def __init__(self, message: str, exit_code: int = -1):
        super().__init__(f"HM Encoder failed with code {exit_code}: {message}")
        self.exit_code = exit_code

class InvalidInputError(HEVCAnalysisError):
    pass

class TraceParseError(HEVCAnalysisError):
    pass
