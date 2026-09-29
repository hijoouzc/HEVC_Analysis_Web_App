from enum import Enum

class StageEnum(str, Enum):
    CP_01_PARTITION = "CP_01_PARTITION"
    CP_02_INTRA_REF = "CP_02_INTRA_REF"
    CP_03_INTRA_SEARCH = "CP_03_INTRA_SEARCH"
    CP_04_INTER_SEARCH = "CP_04_INTER_SEARCH"
    CP_05_RDO_DECISION = "CP_05_RDO_DECISION"
    CP_06_TRANSFORM = "CP_06_TRANSFORM"
    CP_07_QUANT = "CP_07_QUANT"
    CP_08_RECON_FILTER = "CP_08_RECON_FILTER"
    CP_09_CABAC = "CP_09_CABAC"
    
    # Raw hook event aliases
    RDO_INTRA_SEARCH = "RDO_INTRA_SEARCH"

class JobStatus(str, Enum):
    PENDING = "PENDING"
    RUNNING = "RUNNING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    CANCELLED = "CANCELLED"

class ComponentEnum(str, Enum):
    Y = "Y"
    Cb = "Cb"
    Cr = "Cr"
