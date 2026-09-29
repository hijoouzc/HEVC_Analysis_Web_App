Được. Với mục tiêu của bạn, app **không nên chỉ là một animation “chạy qua các block”**, mà nên là một **HEVC Codec Data-Flow Analyzer + Visualizer**: người dùng chọn một frame/CTU/CU, sau đó app cho thấy **data nào đang đi qua block nào, kích thước bao nhiêu, dữ liệu có ý nghĩa gì, được tạo ra từ đâu và được sử dụng ở đâu**.

Dưới đây là **spec tương đối hoàn chỉnh**, bám sát sơ đồ HEVC bạn đưa và có thể dùng làm đặc tả để phát triển app.

---

# SPEC — HEVC Codec Data Flow Analyzer & Visualization App

## 1. Tên ứng dụng

### HEVC Codec Flow Analyzer

**Subtitle:**

> Interactive visualization and data analysis of the HEVC encoding process

### Mục tiêu

Ứng dụng mô phỏng và trực quan hóa quá trình một video frame đi qua **HEVC/H.265 Encoder**, từ:

> Input Video → CTU Partitioning → Prediction → Residual → Transform → Quantization → Reconstruction → Loop Filter → Reference Picture Buffer → Entropy Coding → Bitstream

Đồng thời hiển thị:

* Block nào đang xử lý.
* Data đầu vào của block.
* Data đầu ra.
* Kích thước data.
* Data type.
* Spatial position.
* Quan hệ giữa input/output.
* Quan hệ dependency giữa các block.
* Giá trị thực tế của data.
* Sự thay đổi data sau từng bước.
* Thông tin control/metadata.
* Animation mô tả dòng dữ liệu.
* Phân tích bitrate, distortion và complexity.

---

# 2. Phạm vi của ứng dụng

Ứng dụng tập trung vào **HEVC Encoder**, không phải toàn bộ decoder.

Sơ đồ logic chính:

![Image](https://images.openai.com/static-rsc-4/1AI2sImaXvBc1YGIrAPJ4bi86CMIi3fJLiBEf8C_0ivO-t6lYrx3UxixrKkWhkv3t_8xxFnnJwzmFd1yMoBbc_ehkAcwW_dyLNFvS7bVIHcy0RIkwoTLGuD1Z7ff7sRat7dYJPb9ieUgaLpcYFV3Xu4UJjPlNurvcr6sVLVibnoPdSqpiYRKmGfvxz4KaDBa?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/Ibepq-Krt-EXM3bewS1pw9xqIgguTvafz6_zaapKRiFPWC-gBpoKF9cn-R5yyCbGryNzZd-J_pMSKJ60jKkm-gkMmQZ7WeUq2PofoGPOHQZAyjCoiqXjAUW9OBmixYET81EuKLlicSQQRc0wK0x1J5n21pgiwZMBpcRy5QvFoG9JI55_b7cv_IrXZ0jjNAUc?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/LPuMiW4Q75iQqCK74d8gs_rN82aukPiYimEFVAkp-GcrXL6dd_ANoFSWm3e_69zGZi0yIj2zIyALh8ntvUNJ0bj-gh0pSrYrrRqpwnxjXAJbiVv5GsK6HymTV2wtTv11BDIRW9_GQn0I_EMzUnEX66ysiW4JyYGAQJuzZa9RGlUQWOE3xd82fH4yharHPdiZ?purpose=fullsize)

![Image](https://images.openai.com/static-rsc-4/UBZ1nHXWEJOafd2VpfyDOv4bn5HHXLr_EyQgIfTywpb6LRZltn0LQDxigPGcfm5WF5HXqMxuxijPFCHFgkoTgIGWWAUZ9FHeX3zLf6JQhz1TIIK7VuxDENVhoHGcY8XjQlZ3ZlDfyGd4fFOzY7p-5eTRgW1j2Eki6owXUK6zFUTG1R4RURi-xo-IbJiPo3g2?purpose=fullsize)

```text
                  INPUT VIDEO
                       │
                       ▼
               ┌──────────────┐
               │ Frame/Picture│
               └──────┬───────┘
                      │
                      ▼
                CTU Partition
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
       Intra Prediction   Inter Prediction
             │                 │
             │          Motion Estimation
             │                 │
             │          Motion Compensation
             │                 │
             └────────┬────────┘
                      ▼
                 Residual
                      │
                      ▼
                Transform
                      │
                      ▼
                Quantization
                      │
          ┌───────────┴──────────┐
          │                      │
          ▼                      ▼
 Quantized Coefficients     Inverse Quantization
                                 │
                                 ▼
                         Inverse Transform
                                 │
                                 ▼
                           Reconstruction
                                 │
                                 ▼
                         Deblocking + SAO
                                 │
                 ┌───────────────┴──────────────┐
                 ▼                              ▼
          Reference Picture               Output Picture
             Buffer
                 
 Quantized Coefficients
 Prediction Mode
 Motion Vector
 Filter Parameters
        │
        └──────────────► CABAC
                              │
                              ▼
                        Bitstream
```

**Lưu ý quan trọng:** đây là **logical data flow**, không nhất thiết là thứ tự thời gian tuyệt đối của hardware/software encoder. Một encoder thực tế có thể xử lý nhiều CTU/CU song song và pipeline.

---

# 3. Mục tiêu giáo dục/kỹ thuật

App phải trả lời được câu hỏi:

> **“Một pixel/frame khi đi qua HEVC encoder thì chuyện gì xảy ra với nó?”**

Và ở mức sâu hơn:

> **“Tại mỗi stage, data là gì, kích thước bao nhiêu, được biến đổi như thế nào và stage tiếp theo sử dụng data đó ra sao?”**

Ví dụ:

```text
Original Block
1920×1080 YUV
       │
       ▼
CTU
64×64 Y
       │
       ▼
Prediction Block
32×32 Y
       │
       ▼
Residual
32×32 signed integer
       │
       ▼
Transform
32×32 coefficients
       │
       ▼
Quantization
32×32 quantized coefficients
       │
       ├──────────────► CABAC
       │
       ▼
Inverse Quantization
       │
       ▼
Inverse Transform
       │
       ▼
Reconstructed Block
       │
       ▼
Deblocking + SAO
       │
       ▼
Reference Picture
```

---

# 4. Mô hình dữ liệu tổng thể

App phải phân biệt ít nhất **5 cấp độ dữ liệu**.

| Level         | Đối tượng                 |
| ------------- | ------------------------- |
| Video         | toàn bộ video             |
| Frame/Picture | một ảnh trong video       |
| CTU           | Coding Tree Unit          |
| CU            | Coding Unit               |
| PU/TU         | Prediction/Transform Unit |
| Coefficient   | hệ số transform           |

Quan hệ:

```text
Video
 │
 ├── Frame 0
 │     ├── CTU 0
 │     │     ├── CU
 │     │     │    ├── PU
 │     │     │    └── TU
 │     │     └── CU
 │     ├── CTU 1
 │     └── ...
 │
 ├── Frame 1
 └── ...
```

---

# 5. Input specification

## 5.1 Video input

App hỗ trợ:

```text
.mp4
.mkv
.mov
.yuv
```

và có thể nhận:

```text
YUV420
YUV422
YUV444
8-bit
10-bit
12-bit
```

### Metadata

```text
Resolution
Frame rate
Pixel format
Bit depth
Color space
Frame count
Duration
Codec
GOP structure
```

Ví dụ:

```text
Resolution       : 1920 × 1080
Pixel Format     : YUV420
Bit Depth        : 8-bit
Frame Rate       : 25 fps
Frame Count      : 250
Codec            : HEVC
```

---

# 6. Frame representation

Một frame không được coi đơn giản là một ảnh RGB.

App phải biểu diễn:

```text
Picture
│
├── Y plane
│
├── Cb plane
│
└── Cr plane
```

Ví dụ YUV 4:2:0:

```text
Y  : 1920 × 1080
Cb :  960 × 540
Cr :  960 × 540
```

Nếu 8-bit:

```text
Y  : 2,073,600 samples
Cb :   518,400 samples
Cr :   518,400 samples
```

Tổng:

```text
3,110,400 samples/frame
```

và khoảng:

```text
3,110,400 bytes/frame
```

nếu lưu raw 8-bit 4:2:0.

App phải tự tính các thông số này dựa trên:

```text
width
height
chroma format
bit depth
```

---

# 7. CTU Partitioning

Đây là một trong những visualization quan trọng nhất.

HEVC sử dụng:

> **Coding Tree Unit — CTU**

CTU luma có thể có kích thước tối đa:

```text
64 × 64
```

App phải cho phép visualization:

```text
Frame
 ↓
CTU grid
 ↓
Selected CTU
 ↓
Coding Tree
 ↓
CU partition
```

Ví dụ:

```text
64×64 CTU

┌────────────────────────────────┐
│                                │
│          64 × 64               │
│                                │
├───────────────┬────────────────┤
│               │                │
│    32×32      │     32×32      │
│               │                │
├───────┬───────┼────────────────┤
│16×16  │16×16  │     32×32      │
└───────┴───────┴────────────────┘
```

App phải animate việc partition:

```text
CTU
 ↓
CU split?
 ↓
Yes
 ↓
Split again
 ↓
...
 ↓
Leaf CU
```

---

# 8. Block: General Code Control

### Input

```text
Input frame
Encoder configuration
Sequence parameters
Picture parameters
Rate-control parameters
```

### Output

```text
General Control Data
```

### Data

Ví dụ:

```text
Frame type
QP
Slice type
Reference picture information
Prediction mode candidates
Partition constraints
Transform constraints
Rate-control information
Loop-filter parameters
```

### Visualization

Block:

```text
┌──────────────────────────────┐
│ General Code Control         │
│                              │
│ Frame Type : P               │
│ QP         : 28              │
│ Slice      : 0               │
│ CTU        : 64×64           │
└──────────────────────────────┘
```

Khi animation chạy, control data xuất hiện dưới dạng **control token** khác với pixel data.

---

# 9. Intra-Picture Estimation

## Input

```text
Current picture
Neighboring reconstructed samples
CU/PU information
```

## Output

```text
Intra prediction candidates
Prediction mode
Estimated cost
```

HEVC có các intra prediction modes.

App nên visualize:

```text
Planar
DC
Angular modes
```

Thay vì chỉ hiện:

```text
Mode = 26
```

app nên hiển thị hướng:

```text
       ↗
      ↗
     ↗
─────►
```

và overlay lên block.

### UI

```text
Selected PU: 16×16

Prediction Mode
────────────────
Mode: Angular 26
Direction: ↗
SATD: 1423
```

---

# 10. Intra-Picture Prediction

## Input

```text
Reference neighboring samples
Selected prediction mode
PU dimensions
```

## Output

```text
Predicted block
```

Ví dụ:

```text
Input:

Original block
16×16
8-bit

       +
       ↓

Top / Left reference samples
       +
       ↓
Angular Prediction
       ↓
Predicted block
16×16
8-bit
```

App phải hiển thị **hai hình ảnh cạnh nhau**:

```text
Original        Prediction
┌────────┐      ┌────────┐
│        │      │        │
│ image  │      │ image  │
│        │      │        │
└────────┘      └────────┘
```

---

# 11. Inter Prediction

Đây là phần quan trọng vì nó liên quan đến **motion vector**.

## Input

```text
Current picture
Reference picture(s)
Motion estimation result
PU partition
Motion vector
Reference index
```

## Output

```text
Predicted block
```

---

# 12. Motion Estimation

App phải visualization được:

```text
Current Block
      │
      ▼
Search Region
      │
      ├── Candidate 1
      ├── Candidate 2
      ├── Candidate 3
      ├── ...
      └── Candidate N
             │
             ▼
        Cost calculation
             │
             ▼
       Best candidate
             │
             ▼
       Motion Vector
```

Ví dụ:

```text
Reference Frame

┌─────────────────────────────┐
│                             │
│       Search Window         │
│          ┌──────┐           │
│          │██████│           │
│          └──────┘           │
│             ↑               │
│             │ MV            │
│        Current position     │
└─────────────────────────────┘
```

### Data

```text
Motion Vector:
MVx = +4
MVy = -2

Reference Index:
Ref = 0

Block:
16×16

Search range:
±64 pixels
```

App có thể visualize MV bằng arrow:

```text
Current position
      ● ─────────► ●
                  Reference
```

---

# 13. Motion Compensation

## Input

```text
Reference frame
Motion vector
Reference index
PU size
```

## Output

```text
Inter predicted block
```

Ví dụ:

```text
Reference Frame
      │
      │ MV = (+4,-2)
      ▼
Extract reference samples
      │
      ▼
Interpolation
      │
      ▼
Predicted block
```

Nếu dùng fractional-pel motion:

```text
Integer sample
Half-pel
Quarter-pel
```

app nên có tùy chọn zoom để xem interpolation.

---

# 14. Intra/Inter Selection

Đây là decision block rất quan trọng.

App phải hiển thị:

```text
              Current CU
                  │
        ┌─────────┴─────────┐
        ▼                   ▼
      INTRA                INTER
        │                   │
        ▼                   ▼
   Prediction Cost     Prediction Cost
        │                   │
        └─────────┬─────────┘
                  ▼
              RDO Cost
                  │
                  ▼
             Selected Mode
```

Ví dụ:

```text
Intra cost : 1832
Inter cost : 1420

Selected:
INTER
```

App không chỉ hiển thị kết quả mà nên cho phép:

> **“Why was INTER selected?”**

và hiển thị:

```text
Rate-Distortion Cost

J = D + λR
```

với:

```text
D = distortion
R = estimated bits
λ = Lagrangian multiplier
```

---

# 15. Residual Generation

Đây là data flow cực kỳ quan trọng.

Công thức:

$$
R(x,y)=O(x,y)-P(x,y)
$$

Trong đó:

* \(O\): Original block
* \(P\): Predicted block
* \(R\): Residual block

App phải visualization:

```text
Original
   │
   ├───────────────┐
   │               │
   ▼               ▼
              Prediction
                   │
                   │
                   ▼
             SUBTRACTION
                   │
                   ▼
               Residual
```

Ví dụ:

```text
Original        Prediction       Residual

100             96               +4
102             100              +2
95              97               -2
...
```

### Data type

Residual phải được biểu diễn là:

```text
signed integer
```

không phải unsigned pixel.

Ví dụ:

```text
8-bit original:
0 ... 255

Residual:
negative ... 0 ... positive
```

---

# 16. Transform

## Input

```text
Residual block
```

Ví dụ:

```text
32×32
16×16
8×8
4×4
```

## Output

```text
Transform coefficients
```

Công thức khái niệm:

$$
C=T(R)
$$

App visualization:

```text
Residual
16×16
   │
   ▼
Transform
   │
   ▼
Coefficients
16×16
```

App nên có heatmap:

```text
Low frequency
██████████
██████
███
█

High frequency
```

và khi click coefficient:

```text
Coefficient
Position : (3,5)
Value    : -47
Frequency: medium-high
```

---

# 17. Quantization

## Input

```text
Transform coefficients
QP
Quantization parameters
```

## Output

```text
Quantized transform coefficients
```

Khái niệm:

$$
Q = Quantize(C,QP)
$$

Ví dụ:

```text
Transform coefficient

[  120   -43    7    2 ]
[  -31    18   -3    1 ]
[    9    -4    1    0 ]
[    2     1    0    0 ]

             ↓ Quantization

[  15   -5   1   0 ]
[  -4    2   0   0 ]
[   1    0   0   0 ]
[   0    0   0   0 ]
```

Đây là một visualization cực kỳ hữu ích vì người dùng nhìn thấy trực tiếp:

> **QP tăng → nhiều coefficient bị đưa về 0 → entropy coding có ít information hơn → bitrate giảm nhưng distortion tăng.**

---

# 18. Quantized Transform Coefficients

App phải cung cấp một **Coefficient Viewer**.

Ví dụ:

```text
TU: 8×8

┌────┬────┬────┬────┐
│ 25 │ -4 │  0 │  0 │
├────┼────┼────┼────┤
│ -3 │  2 │  0 │  0 │
├────┼────┼────┼────┤
│  0 │  0 │  0 │  0 │
└────┴────┴────┴────┘
```

Hover:

```text
Coefficient
x = 1
y = 0
value = -4
```

---

# 19. Inverse Quantization

Data flow:

```text
Quantized Coefficients
        │
        ▼
Inverse Quantization
        │
        ▼
Reconstructed Transform Coefficients
```

App phải cho phép so sánh:

```text
Original Transform
        vs
Quantized Transform
        vs
Inverse Quantized Transform
```

---

# 20. Inverse Transform

$$
R' = T^{-1}(C')
$$

Input:

```text
Inverse-quantized coefficients
```

Output:

```text
Reconstructed residual
```

App:

```text
Quantized coefficients
       ↓
Inverse Quantization
       ↓
Inverse Transform
       ↓
Reconstructed Residual
```

---

# 21. Reconstruction

Đây là điểm rất quan trọng.

$$
\hat{X}=P+R'
$$

Trong đó:

* \(P\): predicted block
* \(R'\): reconstructed residual
* \(\hat{X}\): reconstructed block

Visualization:

```text
Prediction
     +
     │
     ▼
Reconstructed Residual
     │
     ▼
   ADD
     │
     ▼
Reconstructed Block
```

App phải so sánh:

```text
Original Block
       │
       │ difference
       ▼
Reconstructed Block
```

và tính:

```text
MSE
MAE
PSNR
```

ở block/frame level.

---

# 22. Deblocking Filter

Input:

```text
Reconstructed picture
Boundary information
QP
Prediction/transform information
```

Output:

```text
Deblocked picture
```

Visualization:

```text
Before Deblocking
┌───────┬───────┐
│       │       │
│       │       │
│       │       │
├───────┼───────┤
│       │       │
└───────┴───────┘
        ↑
      Boundary

        ↓

After Deblocking
┌─────────────────┐
│                 │
│                 │
│                 │
│                 │
└─────────────────┘
```

App có slider:

```text
Before ←────────●────────→ After
```

---

# 23. SAO — Sample Adaptive Offset

Sau deblocking:

```text
Deblocking
    ↓
SAO
    ↓
Filtered Picture
```

App cần hiển thị:

```text
SAO enabled: YES

SAO Type:
  Edge Offset
  Band Offset

Offset parameters:
...
```

Visualization:

```text
Original reconstructed
       ↓
Classify samples
       ↓
Determine offset
       ↓
Apply offset
       ↓
Filtered picture
```

---

# 24. Decoded Picture Buffer / DPB

Đây là phần rất quan trọng để hiểu Inter Prediction.

DPB chứa các reconstructed pictures được dùng làm reference.

Visualization:

```text
             ┌─────────────────┐
             │       DPB       │
             ├─────────────────┤
             │ Frame 0         │
             │ Frame 2         │
             │ Frame 5         │
             │ Frame 7         │
             └─────────────────┘
                    │
                    │ reference
                    ▼
             Motion Estimation
```

App phải cho phép click từng frame:

```text
Frame #12
POC = 12
Reference = YES
Long-term = NO
```

---

# 25. CABAC / Entropy Coding

Đây là nơi dữ liệu chuyển từ **structured coding information** thành **bitstream**.

Input:

```text
Quantized coefficients
Prediction mode
Motion vectors
Reference indices
Partition information
Filter parameters
Other syntax elements
```

Output:

```text
HEVC bitstream
```

---

# 26. CABAC Visualization

Không cần mô phỏng toàn bộ arithmetic coder ở mức hardware ngay từ đầu.

App nên có 3 mức:

### Level 1 — Syntax level

```text
CU
 ├── split_cu_flag
 ├── pred_mode_flag
 ├── intra_luma_pred_mode
 ├── merge_flag
 ├── motion vector
 ├── cbf
 └── coefficients
```

### Level 2 — Bin level

```text
Syntax Element
      ↓
Binary decision
      ↓
Bins
```

### Level 3 — Bitstream

```text
101001101001011...
```

Click vào một bit phải cho biết:

```text
Bit position
Syntax element
Context
Associated CU/PU/TU
```

Đây sẽ là một tính năng rất mạnh của app.

---

# 27. Bitstream Visualization

Hiển thị:

```text
NAL Unit
│
├── VPS
├── SPS
├── PPS
├── Slice
│    ├── Header
│    └── CABAC data
└── ...
```

User click:

```text
Slice
  ↓
CTU
  ↓
CU
  ↓
PU
  ↓
TU
  ↓
Syntax elements
  ↓
CABAC bins
  ↓
bits
```

---

# 28. Data Object Specification

Mỗi data object trong app phải có metadata.

Ví dụ:

```json
{
  "name": "Residual",
  "type": "ResidualBlock",
  "frame_id": 12,
  "ctu_id": 35,
  "cu_id": 4,
  "tu_id": 2,
  "position": {
    "x": 256,
    "y": 128
  },
  "size": {
    "width": 16,
    "height": 16
  },
  "component": "Y",
  "bit_depth": 8,
  "data_type": "signed_integer"
}
```

---

# 29. Data phải có 4 loại thông tin

Mỗi đường data trong visualization phải phân biệt:

### 1. Pixel/sample data

```text
Y/Cb/Cr
```

### 2. Residual/coefficient data

```text
signed integer
```

### 3. Control data

```text
QP
mode
partition
flags
```

### 4. Syntax/bitstream data

```text
CABAC bins
bits
NAL units
```

---

# 30. Data Flow Visualization

Mỗi connection phải có:

```text
Source
Destination
Data type
Dimensions
Bit depth
Meaning
```

Ví dụ:

```text
Transform
      │
      │ Transform Coefficients
      │ 16×16
      │ signed integer
      ▼
Quantization
```

Hover vào arrow:

```text
─────────────────────────────
DATA FLOW
─────────────────────────────

From:
Transform

To:
Quantization

Data:
Transform Coefficients

Component:
Y

Size:
16 × 16

Type:
Signed Integer

Bit depth:
Implementation dependent

Meaning:
Frequency-domain representation
of residual block
─────────────────────────────
```

---

# 31. Animation Engine

Đây là phần cốt lõi của app.

## Animation object

Mỗi data object có:

```text
origin
destination
timestamp
duration
data type
payload
```

Ví dụ:

```text
Frame
 ↓
CTU
 ↓
Prediction
 ↓
Residual
 ↓
Transform
 ↓
Quantization
```

Animation token:

```text
●
```

di chuyển theo arrow.

Nhưng không nên chỉ có một token.

Có thể dùng:

```text
Blue  = pixel/sample data
Green = prediction data
Orange = residual
Purple = coefficient
Red = control
White = bitstream
```

Màu sắc nên là **configurable**, không hard-code.

---

# 32. Animation levels

App có 4 mức.

### Level 1 — Frame level

```text
Frame
 → Prediction
 → Transform
 → Quantization
 → Filter
 → Bitstream
```

### Level 2 — CTU level

```text
Frame
 ↓
CTU #34
 ↓
CTU #35
 ↓
CTU #36
```

### Level 3 — CU level

```text
CTU
 ↓
CU #0
 ↓
CU #1
 ↓
CU #2
```

### Level 4 — Data level

```text
Pixel
 ↓
Prediction
 ↓
Residual
 ↓
Coefficient
 ↓
CABAC bin
```

---

# 33. Main UI Layout

Tôi đề xuất giao diện chính gồm **4 vùng**.

```text
┌─────────────────────────────────────────────────────────────┐
│ HEVC CODEC FLOW ANALYZER                  Frame 12 | Play ▶ │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                    CODEC FLOW                               │
│                                                             │
│  Input → Prediction → Residual → Transform → Quantization  │
│                                  ↓                          │
│                         Reconstruction → Filter → DPB       │
│                                                             │
├──────────────────────────┬──────────────────────────────────┤
│                          │                                  │
│     VISUALIZATION        │       DATA INSPECTOR             │
│                          │                                  │
│ Original / Prediction    │ Block: CU #23                    │
│ Residual / Coefficient   │ Position: (256,128)              │
│ Frame / CTU / CU         │ Size: 16×16                      │
│                          │ Data: Residual                   │
│                          │ Type: signed int                 │
│                          │                                  │
├──────────────────────────┴──────────────────────────────────┤
│ Timeline                                                   │
│ ●────●────●────●────●────●────●────●                     │
│ Frame CTU Prediction Transform Quant Filter CABAC          │
└─────────────────────────────────────────────────────────────┘
```

---

# 34. Central Flow Canvas

Đây là màn hình chính.

Các block phải bám theo sơ đồ HEVC gốc:

```text
                 General Code Control
                         │
                         ▼
Input ────────► Prediction ───► Transform ───► Quantization
 │                  ▲                              │
 │                  │                              │
 │             Motion/Intra                       │
 │                                                ▼
 │                                      Inverse Quantization
 │                                                │
 │                                                ▼
 │                                        Inverse Transform
 │                                                │
 │                                                ▼
 │                                           Reconstruction
 │                                                │
 │                                                ▼
 │                                      Deblocking + SAO
 │                                                │
 │                                                ▼
 │                                               DPB
 │                                                │
 │                                                ▼
 └──────────────────────────────────────► Prediction

Quantized coefficients
        │
        ├─────────────────────────┐
        ▼                         ▼
   CABAC / Header            Bitstream
```

---

# 35. Visualization của frame

Khi chọn:

```text
Frame 12
```

app hiển thị:

### View 1 — Original

```text
Original Frame
```

### View 2 — CTU map

```text
┌─┬─┬─┬─┬─┬─┐
├─┼─┼─┼─┼─┼─┤
├─┼─┼─┼─┼─┼─┤
└─┴─┴─┴─┴─┴─┘
```

### View 3 — Partition map

```text
64×64
 ↓
32×32
 ↓
16×16
 ↓
8×8
```

### View 4 — Motion vectors

Overlay arrows trên frame.

### View 5 — Residual heatmap

### View 6 — Transform coefficient map

### View 7 — Reconstruction error

---

# 36. Click interaction

Ví dụ user click vào một vùng:

```text
Frame
  ↓
CTU #35
  ↓
CU #7
  ↓
PU #2
```

App phải highlight **toàn bộ dependency chain**.

```text
Original Block
      │
      ▼
Prediction
      │
      ▼
Residual
      │
      ▼
Transform
      │
      ▼
Quantization
      │
      ▼
CABAC
```

Đồng thời highlight những data khác liên quan:

```text
Reference Frame #8
       │
       ▼
Motion Vector
       │
       ▼
Prediction
```

---

# 37. Data Inspector

Khi click một block:

```text
┌─────────────────────────────────────┐
│ DATA INSPECTOR                      │
├─────────────────────────────────────┤
│ Frame        : 12                   │
│ CTU          : 35                   │
│ CU           : 7                    │
│ PU           : 2                    │
│ TU           : 1                    │
│                                     │
│ Position     : (256,128)            │
│ Size         : 16 × 16              │
│ Component    : Y                    │
│ Bit depth    : 8                    │
│                                     │
│ Prediction   : INTER                │
│ Ref index    : 0                    │
│ MV           : (+4,-2)              │
│ QP           : 28                   │
│                                     │
│ Transform    : 16×16                │
│ Non-zero coeffs : 37                │
│                                     │
│ CABAC bits   : 214                  │
└─────────────────────────────────────┘
```

---

# 38. Data Relationship Graph

App phải có một chế độ riêng:

> **Data Dependency View**

Ví dụ:

```text
Original Block
      │
      ├──────────────────────┐
      │                      │
      ▼                      ▼
Prediction              Original
      │                      │
      └────────┬─────────────┘
               ▼
            Residual
               │
               ▼
           Transform
               │
               ▼
        Transform Coeff.
               │
               ▼
          Quantization
               │
               ▼
       Quantized Coeff.
               │
          ┌────┴─────┐
          ▼          ▼
        CABAC    Inverse Q
                     │
                     ▼
                  ITransform
                     │
                     ▼
                Reconstruction
```

Điều này giúp user hiểu:

> **Một output của block có thể đi tới nhiều block khác nhau.**

Ví dụ quantized coefficient:

```text
Quantized Coefficients
       │
       ├────► CABAC
       │
       └────► Inverse Quantization
```

---

# 39. Frame-level analysis

App cần dashboard:

```text
FRAME ANALYSIS
────────────────────────────

Frame        : 120
Type         : P
Resolution   : 1920×1080
QP           : 28

Original size
   ↓
Decoded size

Bitrate       : xxx kbps
Bits/frame    : xxx

PSNR-Y       : xx.xx dB
PSNR-U       : xx.xx dB
PSNR-V       : xx.xx dB

SSIM-Y       : x.xxxx
```

---

# 40. Coding Efficiency Analysis

Vì hướng nghiên cứu của bạn là **video compression optimization**, phần này rất đáng đưa vào spec.

App phải phân tích:

```text
Bitrate
Compression Ratio
PSNR
SSIM
VMAF
Encoding Time
Complexity
```

Ví dụ:

```text
Encoding time
──────────────────────
Motion Estimation   42%
RDO                 31%
Transform            8%
CABAC                7%
Filtering            5%
Other                7%
```

Từ đó user có thể nhìn thấy:

> **Block nào tốn computational complexity nhưng đóng góp gì cho coding efficiency.**

---

# 41. Optimization Analysis

Đây là phần có thể nối trực tiếp với đề tài nghiên cứu của bạn.

Ví dụ app cho phép bật/tắt:

```text
[✓] Full RDO
[✓] Motion Estimation
[✓] Intra Mode Search
[✓] Transform Search
[✓] SAO
[✓] Deblocking
```

Sau đó so sánh:

| Configuration | Bitrate | PSNR | Encoding Time |
| ------------- | ------: | ---: | ------------: |
| Baseline      |     ... |  ... |           ... |
| Fast Mode     |     ... |  ... |           ... |
| Optimized     |     ... |  ... |           ... |

Nhưng app chỉ **hiển thị dữ liệu thực nghiệm**, không tự kết luận phương pháp nào "tốt nhất".

---

# 42. Timeline

Timeline phải cho phép pause ở **bất kỳ stage nào**.

```text
0 ms       10 ms       20 ms       30 ms
│           │           │           │
Input       Pred        Transform   CABAC
│           │           │           │
●───────────●───────────●───────────●
```

Controls:

```text
◀ Previous
▶ Play
⏸ Pause
▶ Next
⏩ Fast
```

Speed:

```text
0.25×
0.5×
1×
2×
4×
```

---

# 43. Step-by-step mode

Có nút:

> **Step**

Mỗi lần click:

```text
Step 1:
Frame enters encoder

Step 2:
Frame split into CTUs

Step 3:
CTU #0 selected

Step 4:
Intra/Inter decision

Step 5:
Prediction generated

Step 6:
Residual calculated

Step 7:
Transform

Step 8:
Quantization

Step 9:
Reconstruction

Step 10:
Deblocking

Step 11:
SAO

Step 12:
CABAC

Step 13:
Bitstream
```

---

# 44. Important: không được mô hình hóa HEVC thành một pipeline tuyến tính đơn giản

Đây là yêu cầu **bắt buộc** trong spec.

Không được visualization kiểu:

```text
Frame
 ↓
Intra
 ↓
Motion
 ↓
Transform
 ↓
Quant
```

vì nó sai về mặt logic.

Phải biểu diễn được:

```text
                     ┌── Intra Estimation
                     │
Current Block ───────┤
                     │
                     └── Motion Estimation
                              │
                              ▼
                       Mode Decision
                              │
                    ┌─────────┴─────────┐
                    ▼                   ▼
               Intra Pred           Inter Pred
                    │                   │
                    └─────────┬─────────┘
                              ▼
                           Residual
                              │
                              ▼
                           Transform
```

Và:

```text
Prediction
     │
     │
     ▼
   ADD ◄──── Inverse Transform
     │
     ▼
Reconstruction
     │
     ▼
Deblocking
     │
     ▼
SAO
     │
     ▼
DPB
     │
     └──────────────► future Inter Prediction
```

---

# 45. Frame dependency visualization

App phải có khả năng hiển thị:

```text
Frame 0 ───────► Frame 2
                  │
Frame 1 ──────────┤
                  ▼
               Frame 3
```

Ví dụ:

```text
         Reference
            │
            ▼
Frame 10 ──► Frame 12
            │
            ▼
          Frame 14
```

Click vào Frame 12:

```text
References:
Frame 10
Frame 11

Referenced by:
Frame 14
Frame 15
```

---

# 46. Slice / Tile / CTU awareness

App nên có hierarchy:

```text
Sequence
 └── Picture
      └── Slice
           └── CTU
                └── CU
                     ├── PU
                     └── TU
```

Nếu muốn bám HEVC sâu hơn, cần hỗ trợ:

```text
VPS
SPS
PPS
Slice Header
CTU
CU
PU
TU
```

---

# 47. Control Data Visualization

Đường nét liền:

```text
──────
```

cho **pixel/data flow**.

Đường nét đứt:

```text
- - - -
```

cho **control/configuration flow**.

Ví dụ giống hình gốc:

```text
General Control
      - - - - - - - - >
Quantization
```

Các control data:

```text
QP
Prediction Mode
Partition Mode
MV
Reference Index
Filter Parameters
CABAC Context
```

---

# 48. Data Type Legend

App cần một legend:

```text
PIXEL DATA
Y / Cb / Cr

PREDICTION DATA
Intra Prediction
Inter Prediction
Motion Vector

RESIDUAL DATA
Signed Residual

TRANSFORM DATA
Transform Coefficients

CONTROL DATA
QP / Mode / Flags

SYNTAX DATA
CABAC / NAL / Bitstream
```

---

# 49. Zoom hierarchy

Visualization phải hỗ trợ:

### Zoom 1 — Video

```text
1920×1080
```

### Zoom 2 — CTU

```text
64×64
```

### Zoom 3 — CU

```text
32×32
```

### Zoom 4 — PU/TU

```text
16×16
```

### Zoom 5 — Sample

```text
individual sample
```

Ví dụ:

```text
1920×1080
      ↓ zoom
64×64 CTU
      ↓ zoom
32×32 CU
      ↓ zoom
16×16 PU
      ↓ zoom
sample matrix
```

---

# 50. Compare Mode

Cho phép:

```text
Original vs Prediction
Original vs Reconstruction
Original vs Quantized
Before Filter vs After Filter
```

Slider:

```text
Original
     │
     ├────────────●────────────┤
     │                         │
Original                  Reconstruction
```

---

# 51. Residual Heatmap

Một trong những visualization quan trọng nhất:

```text
Residual magnitude

low ─────────────── high
```

Cho phép:

```text
Absolute residual
Signed residual
Mean residual
Maximum residual
```

---

# 52. Coefficient Heatmap

Hiển thị:

```text
Transform coefficient magnitude
```

và:

```text
Non-zero coefficient count
Zero coefficient ratio
```

Ví dụ:

```text
Before Q:

██████████████
██████████
████
██

After Q:

███
█
.
.
```

---

# 53. Bit Allocation Visualization

Frame:

```text
Total bits = 120,000
```

phân bố:

```text
Header       3%
Motion       18%
Intra        10%
Residual     61%
Filter        2%
Other         6%
```

Đây rất phù hợp để nghiên cứu **coding efficiency**.

---

# 54. Complexity Visualization

Cho từng module:

```text
Motion Estimation
████████████████████ 42%

RDO
███████████████      31%

Transform
████                  8%

CABAC
███                   7%

Filter
██                    5%
```

Có thể click:

```text
Motion Estimation
        ↓
Search candidates
        ↓
Cost calculation
        ↓
MV decision
```

---

# 55. Trace Data Model

Nếu app chạy với encoder thật, cần một **trace layer**.

Ví dụ:

```json
{
  "frame": 12,
  "ctu": 35,
  "cu": 7,
  "pu": 2,
  "tu": 1,

  "position": [256,128],

  "size": [16,16],

  "prediction": {
    "type": "inter",
    "reference": 0,
    "mv": [4,-2]
  },

  "transform": {
    "size": [16,16]
  },

  "quantization": {
    "qp": 28
  },

  "coefficients": {
    "nonzero": 37
  },

  "entropy": {
    "bits": 214
  }
}
```

---

# 56. Hai chế độ hoạt động

## Mode A — Educational Simulation

Không cần encoder thật.

App tự sinh:

```text
Frame
→ CTU
→ Prediction
→ Residual
→ Transform
→ Quantization
→ Reconstruction
```

Mục tiêu:

> hiểu algorithm/data flow.

---

## Mode B — Real Encoder Trace

Kết nối với encoder thật:

```text
FFmpeg
x265
HM
VTM
```

và thu thập:

```text
CTU partition
CU partition
Prediction mode
MV
QP
Transform
Coefficient
Bitstream
Encoding time
```

Mục tiêu:

> phân tích encoder thực tế.

Đây mới là phần có giá trị nghiên cứu cao hơn.

---

# 57. Architecture của App

Tôi đề xuất:

```text
                 ┌──────────────────┐
                 │     Frontend     │
                 │                  │
                 │ Flow Visualization│
                 │ Frame Viewer     │
                 │ Data Inspector   │
                 │ Timeline         │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ Visualization    │
                 │ Engine           │
                 │                  │
                 │ Animation        │
                 │ Dependency Graph │
                 │ Heatmap          │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ Codec Model      │
                 │                  │
                 │ CTU/CU/PU/TU     │
                 │ Prediction       │
                 │ Transform        │
                 │ Quantization     │
                 │ Filter           │
                 │ CABAC            │
                 └────────┬─────────┘
                          │
                          ▼
                 ┌──────────────────┐
                 │ Trace / Encoder  │
                 │ Adapter          │
                 │                  │
                 │ x265 / HM / VTM  │
                 │ FFmpeg           │
                 └──────────────────┘
```

---

# 58. Core object model

App nên có các object chính:

```text
Video
Picture
Slice
CTU
CU
PU
TU

Prediction
MotionVector
Residual
TransformCoefficient
QuantizedCoefficient

ReferencePicture
FilterData
SyntaxElement
CABACBin
Bitstream
```

Quan hệ:

```text
Picture
  └── Slice
       └── CTU
            └── CU
                 ├── PU
                 │    └── Prediction
                 │
                 └── TU
                      ├── Residual
                      ├── Transform
                      └── Quantization
```

---

# 59. Required user interactions

Người dùng phải có thể:

### A. Select frame

```text
Frame 0
Frame 1
Frame 2
...
```

### B. Select CTU

Click trực tiếp trên frame.

### C. Select CU

Zoom vào CTU.

### D. Select data

Click:

```text
Residual
MV
Coefficient
QP
```

### E. Play flow

```text
▶
```

### F. Step

```text
Next Stage
```

### G. Inspect

```text
Show Data
```

### H. Compare

```text
Original / Prediction / Reconstruction
```

---

# 60. Acceptance Criteria

App được coi là đạt khi có thể thực hiện được scenario:

### Scenario

Input:

```text
1920×1080
YUV420
8-bit
HEVC
```

User chọn:

```text
Frame #20
```

Sau đó click:

```text
CTU (5,3)
```

App phải hiển thị:

```text
CTU position:
x = 320
y = 192

Size:
64×64
```

User click CU:

```text
CU #7
```

App hiển thị:

```text
Size: 16×16
Prediction: INTER
MV: (+4,-2)
Reference: Frame #18
QP: 28
```

Sau đó nhấn:

```text
▶
```

app animation:

```text
Original
 ↓
Inter Prediction
 ↓
Residual
 ↓
Transform
 ↓
Quantization
 ↓
Inverse Quantization
 ↓
Inverse Transform
 ↓
Reconstruction
 ↓
Deblocking
 ↓
SAO
 ↓
DPB
 ↓
CABAC
 ↓
Bitstream
```

Ở **mỗi bước**, app phải cho biết:

```text
Input
Output
Size
Data type
Meaning
Source
Destination
```

---

# 61. Một điểm rất quan trọng đối với app của bạn

Tôi sẽ thiết kế app theo **3 lớp visualization**, thay vì chỉ một animation.

### Layer 1 — Codec Architecture

```text
┌──────────┐
│Prediction│
└────┬─────┘
     ▼
┌──────────┐
│Transform │
└────┬─────┘
     ▼
┌──────────┐
│Quantize  │
└──────────┘
```

→ Cho biết **codec đang làm gì**.

---

### Layer 2 — Data Flow

```text
Original Block
     │
     │ 16×16 Y
     ▼
Prediction
     │
     │ 16×16 Y
     ▼
Residual
     │
     │ 16×16 signed
     ▼
Transform
```

→ Cho biết **data gì đang chạy**.

---

### Layer 3 — Data Content

Ví dụ click Residual:

```text
Residual
16×16

+4   +2   -1 ...
+3   -2   +5 ...
...
```

→ Cho biết **bên trong data thực sự là gì**.

Đây là 3 tầng mà app của bạn nên có:

> **What → How → Actual Data**

---

# 62. MVP nên làm trước

Không nên ngay từ đầu implement toàn bộ HEVC + CABAC + VTM.

### Phase 1 — Visualization

```text
Input Frame
 ↓
CTU
 ↓
Prediction
 ↓
Residual
 ↓
Transform
 ↓
Quantization
 ↓
Reconstruction
 ↓
Filter
 ↓
Output
```

### Phase 2 — Data Inspector

Thêm:

```text
dimensions
datatype
QP
MV
mode
coefficients
```

### Phase 3 — Animation

```text
step
play
pause
speed
timeline
```

### Phase 4 — Real HEVC Trace

```text
x265 / FFmpeg
        ↓
trace
        ↓
app
```

### Phase 5 — Research Analysis

```text
Bitrate
PSNR
SSIM
VMAF
Encoding time
Module complexity
```

---

# 63. Đặc tả cốt lõi — phiên bản ngắn để đưa vào proposal

Nếu bạn cần một đoạn **Specification chính thức**, tôi đề xuất ghi:

> **The proposed application is an interactive HEVC codec data-flow analyzer and visualization tool. The application visualizes the encoding process of an input video at frame, CTU, CU, PU, and TU levels based on the HEVC encoder architecture. It provides an animated representation of the data flow through intra/inter prediction, motion estimation and compensation, residual generation, transform, quantization, inverse processing, reconstruction, deblocking, SAO, decoded picture buffering, and CABAC entropy coding. For each processing stage, the application displays the input/output data, data dimensions, data type, bit depth, spatial position, coding parameters, and dependencies between processing blocks. Users can select a frame or coding block and trace its complete data path from the original samples to reconstructed samples and the generated bitstream. The application also provides visualization of CTU/CU partitioning, motion vectors, prediction modes, residual maps, transform coefficients, quantization effects, reconstructed errors, reference-picture dependencies, bitrate distribution, and encoding complexity. The system supports both educational simulation and trace-based analysis of a real HEVC encoder.**

---

## 64. Kiến trúc visualization cuối cùng tôi khuyên bạn dùng

Nếu mục đích của app là **học + nghiên cứu optimization HEVC**, flow trung tâm nên giữ gần như nguyên bản sơ đồ bạn đưa:

```text
                         ┌──────────────────────┐
                         │ General Code Control │
                         └──────────┬───────────┘
                                    │
                                    ▼
 INPUT FRAME ────────► CTU / CU PARTITION
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        INTRA ESTIMATION             MOTION ESTIMATION
                │                           │
                ▼                           ▼
        INTRA PREDICTION            MOTION COMPENSATION
                │                           │
                └─────────────┬─────────────┘
                              ▼
                       INTRA / INTER
                         DECISION
                              │
                              ▼
                         SUBTRACTION
                              │
                              ▼
                          RESIDUAL
                              │
                              ▼
                       TRANSFORM
                              │
                              ▼
                       QUANTIZATION
                              │
                    ┌─────────┴──────────┐
                    │                    │
                    ▼                    ▼
             QUANTIZED COEFF.     INVERSE QUANT
                    │                    │
                    │                    ▼
                    │             INVERSE TRANSFORM
                    │                    │
                    │                    ▼
                    │              RECONSTRUCTION
                    │                    │
                    │                    ▼
                    │             DEBLOCKING + SAO
                    │                    │
                    │                    ▼
                    │                   DPB
                    │                    │
                    │                    └──────►
                    │                             Prediction
                    │
                    ▼
                 CABAC
                    │
                    ▼
               BITSTREAM
```

**Điểm khác biệt quan trọng:** app không chỉ animate các mũi tên. Nó phải cho phép user **“đi xuyên vào” từng mũi tên**:

> **Frame → CTU → CU → PU/TU → Data → Numerical values → Next block**

Đó mới là phần biến app này từ một **codec animation** thành một **HEVC data-flow analysis tool** có giá trị cho hướng nghiên cứu **optimization of video compression** của bạn.

---

# 65. Kiến trúc Trace-driven (Tích hợp HM Reference Code)

Quyết định chuyển trục kiến trúc sang **Trace-driven Architecture (Kiến trúc hướng vết)** với lõi là bộ mã nguồn HM chính là bước ngoặt biến dự án từ một "tool vẽ đồ thị đơn giản" thành một **hệ thống phân tích R&D (Research & Development) đạt chuẩn công nghiệp**.

Tất cả các công cụ phân tích video codec thương mại hàng đầu thế giới (như Elecard StreamEye, SolveigMM Zond) đều được xây dựng dựa trên nguyên lý này: Bắt vết (hook) vào Decoder/Encoder tham chiếu để trích xuất Ground Truth.

## 65.1. Nâng cấp VisualDumper thành Data Parser Engine
Sử dụng **JSON Lines (JSONL)** thay cho CSV rời rạc. 
Quá trình encode tạo ra lượng data khổng lồ. Việc dùng JSONL (ghi từng dòng là một object JSON độc lập) giúp Data Parser có thể đọc luồng (stream) từng dòng mà không sợ tràn RAM hay hỏng toàn bộ data nếu HM crash giữa chừng.

**Ví dụ cấu trúc Trace 1 dòng (ghi từ C++ HM):**
```json
{"poc": 0, "ctu_x": 0, "ctu_y": 0, "depth": 2, "cu_size": 16, "event": "RDO_INTRA_SEARCH", "mode": 26, "cost": 1452.3, "pred_data": [120, 122, ...], "resi_data": [2, -1, ...]}
```

## 65.2. Các "Điểm Hook" trong C++ (HM Reference Software)
Frontend sẽ lấy dữ liệu từ các hàm cụ thể của HM. Dưới đây là bản đồ Mapping chuẩn xác:

| Loại Dữ Liệu Cần Visualize | Vị Trí Chèn Hook (HM C++ File) | Chức năng (Data flow) |
| --- | --- | --- |
| **CTU Partitioning** | `TEncCu::xCompressCU` | Ghi lại cấu trúc Z-order, kích thước CU/PU/TU cuối cùng (Best Cost). |
| **Intra Mode Search** | `TEncSearch::estIntraPredLumaQT` | Dump cost của từng mode, pixel dự đoán, mảng reference. |
| **Motion Estimation** | `TEncSearch::xMotionEstimation` | Ghi lại MV, điểm ảnh tham chiếu từ Reference Picture. |
| **Transform & Quantization** | `TComTrQuant::transformNxN` | Ghi lại mảng dư (Residual) → Hệ số DCT (Coeff) → Lượng tử hóa. |
| **Entropy Coding (CABAC)** | `TEncEntropy::encodeCU` | Ghi lại số lượng bit thực tế bị tiêu tốn cho từng syntax element. |

## 65.3. Giải quyết bài toán "Data Explosion" bằng ROI Tracing
Để Frontend không bị treo khi đọc hàng GB dữ liệu cho mỗi giây video, cần thiết kế cơ chế **Region of Interest (ROI) Tracing** ngay trong C++:
* Thêm cờ vào CLI của HM (ví dụ: `--TracePOC=0 --TraceCTU_X=2 --TraceCTU_Y=3`).
* HM chạy bình thường (nhanh) cho đến khi chạm đúng Frame (POC) và tọa độ CTU đó. Lúc này cờ `m_isActiveForCurrentContext` của `VisualDumper` mới bật lên và bắt đầu ghi file JSONL.
* Frontend chỉ cần load file log vài MB thay vì vài GB.

## 65.4. Thiết kế Frontend Dashboard Web App
* **Backend (Data Parser Engine):** Đọc file JSONL do HM sinh ra, gom nhóm dữ liệu theo phân cấp (Frame → Slice → CTU → CU). Có thể viết bằng Python FastAPI hoặc Node.js.
* **Frontend (Visualization):** 
  * Sử dụng **React/Next.js**.
  * Vẽ ma trận pixel bằng HTML5 Canvas hoặc CSS Grid.
  * **Timeline Slider:** Cho phép kéo thanh trượt xem HM đã thử nghiệm các Mode RDO như thế nào trước khi chọn ra Mode tốt nhất.
