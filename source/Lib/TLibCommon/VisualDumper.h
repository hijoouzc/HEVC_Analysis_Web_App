#ifndef VISUAL_DUMPER_H
#define VISUAL_DUMPER_H

#include "CommonDef.h"
#include <string>
#include <fstream>
#include <iostream>

class TComDataCU;

#define ENABLE_VISUAL_DUMP 1

class VisualDumper {
private:
    static VisualDumper* s_instance;
    std::string m_outputDir;
    std::ofstream m_outFile;
    
    Bool m_enabled;
    Bool m_exitOnFinish;
    Int m_targetPOC;
    Int m_targetCtuX;
    Int m_targetCtuY;
    Int m_targetCuSize;
    
    Int m_currentPOC;
    Int m_currentCtuX;
    Int m_currentCtuY;
    Int m_dumpCount;
    Int m_intraSearchCount;
    Bool m_intraRefDumped;

    VisualDumper();
    ~VisualDumper();

public:
    static VisualDumper* getInstance() {
        if (!s_instance) s_instance = new VisualDumper();
        return s_instance;
    }

    Bool isEnabled() const { return m_enabled; }

    Void setROI(Int poc, Int ctuX, Int ctuY, Int cuSize) {
        m_targetPOC = poc;
        m_targetCtuX = ctuX;
        m_targetCtuY = ctuY;
        m_targetCuSize = cuSize;
    }

    Void setContext(Int poc, Int ctuX, Int ctuY) {
        m_currentPOC = poc;
        m_currentCtuX = ctuX;
        m_currentCtuY = ctuY;
    }
    
    Bool isActive(Int cuSize) const { 
        return m_enabled &&
               (m_currentPOC == m_targetPOC) && 
               (m_currentCtuX == m_targetCtuX) && 
               (m_currentCtuY == m_targetCtuY) &&
               (cuSize == m_targetCuSize); 
    }

    Void dumpIntraRefSamples(Int cuSize,
                             const Pel* pRefUnfilt, const Pel* pRefFilt, Int refStride,
                             Bool strongIntraSmoothing,
                             const Pel* pRefUnfiltU, const Pel* pRefUnfiltV,
                             const Pel* pRefFiltU, const Pel* pRefFiltV, Int refStrideC);

    Void dumpIntraSearchStep(Int cuSize, Int mode, Double cost, Bool bUseFilter,
                             const Pel* pOrg, const Pel* pPred, const Pel* pResi, Int stride,
                             const Pel* pRef, Int refStride,
                             const Pel* pOrgU, const Pel* pOrgV,
                             const Pel* pPredU, const Pel* pPredV,
                             Int strideC, Int predStrideC,
                             const Pel* pRefU, const Pel* pRefV);

    Void dumpPartitionTree(TComDataCU* pcCU);

    Void dumpTransformQuant(Int poc, Int ctuX, Int ctuY, Int tuX, Int tuY, Int tuWidth, Int tuHeight,
                            Int compID, Int qp,
                            const Pel* pResi, Int resiStride,
                            const TCoeff* pDctCoeff, const TCoeff* pQCoeff);
};

#if ENABLE_VISUAL_DUMP
    #define DUMP_SET_ROI(poc, ctuX, ctuY, cuSize) VisualDumper::getInstance()->setROI(poc, ctuX, ctuY, cuSize)
    #define DUMP_SET_CONTEXT(poc, ctuX, ctuY) VisualDumper::getInstance()->setContext(poc, ctuX, ctuY)
#else
    #define DUMP_SET_ROI(poc, ctuX, ctuY, cuSize)
    #define DUMP_SET_CONTEXT(poc, ctuX, ctuY)
#endif
#endif
