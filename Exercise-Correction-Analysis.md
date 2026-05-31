# Exercise-Correction Analysis

Tài liệu này tóm tắt repo `Exercise-Correction/`, cách nó xử lý video bài tập, và các hướng có thể tận dụng để phát triển GymFixer hiện tại. Bối cảnh GymFixer được đối chiếu từ `README.md` và `LLM.md`.

## 1. GymFixer hiện tại

GymFixer hiện đang đi theo luồng after-session video analysis:

```text
Next.js frontend
  -> login/register bằng JWT
  -> chọn squat | bicep_curl
  -> upload video
  -> POST /posture/analyze-video

FastAPI backend
  -> tạo workout_sessions
  -> sample frame bằng OpenCV
  -> chạy pose backend: MediaPipe hoặc ViTPose
  -> subject-ready gate
  -> visibility gate theo bài
  -> tính angle
  -> phase detector + rep count
  -> rule-based feedback
  -> optional Gemini coaching
  -> lưu PostgreSQL
  -> trả summary, frame_log, mistake preview frames
```

Điểm quan trọng của thiết kế hiện tại là pipeline dùng chung. MediaPipe và ViTPose đều được normalize về landmark format tương tự nhau, rồi dùng chung gate, angle extraction, phase detector, feedback, persistence và UI.

Hiện frontend chính chỉ cho chọn `squat` và `bicep_curl`, dù backend đã có angle/feedback sơ bộ cho thêm `lunge`, `deadlift`, `pushup`, `shoulder_press`. Phase detector hoàn chỉnh mới có cho `squat` và `bicep_curl`.

## 2. Exercise-Correction xử lý như thế nào

Repo `Exercise-Correction/` có hai phần:

- `core/`: notebook, CSV, model training và evaluation.
- `web/`: demo app Vue 3 + Django REST, nhận video upload rồi trả video/frame đã phân tích.

Luồng runtime chính nằm ở:

- `Exercise-Correction/web/server/stream_video/views.py`
- `Exercise-Correction/web/server/detection/main.py`
- `Exercise-Correction/web/server/detection/*.py`

Pipeline của nó:

```text
Vue client
  -> upload video multipart kèm query type

Django endpoint upload_video
  -> lấy temporary_file_path của video
  -> gọi exercise_detection(video_path, output_name, exercise_type)

detection/main.py
  -> load model theo bài vào global EXERCISE_DETECTIONS
  -> OpenCV đọc toàn bộ video
  -> resize frame mặc định 40%
  -> MediaPipe Pose detect từng frame
  -> gọi detector riêng cho từng bài
  -> detector annotate trực tiếp lên frame
  -> VideoWriter ghi video mp4 đã overlay
  -> lưu các frame lỗi thành static image
  -> trả JSON gồm details, counter, file_name
```

Khác với GymFixer, repo này không có subject-ready gate, không có quality summary, không lưu session/user analytics, không có LLM coaching. Nó thiên về demo CV: xử lý frame, vẽ overlay, ghi video đã annotate, trả frame bằng chứng cho lỗi.

## 3. Các bài tập và logic phát hiện

### Bicep curl

File: `Exercise-Correction/web/server/detection/bicep_curl.py`

Nó kết hợp ML và rule:

- ML model `bicep_curl_model.pkl` + scaler để phát hiện lỗi đứng/ngả lưng, class chính là lean-back.
- Mỗi tay có `BicepPoseAnalysis` riêng để đếm rep và phát hiện lỗi tay.
- Rep count: nếu elbow angle lớn hơn `120` thì stage `down`; nếu elbow angle nhỏ hơn `100` khi đang `down` thì chuyển `up` và tăng counter.
- Loose upper arm: tính góc upper arm so với trục dọc; nếu lớn hơn `40` độ thì báo `LOOSE_UPPER_ARM`.
- Weak peak contraction: trong stage `up`, lưu elbow angle nhỏ nhất; khi quay về `down`, nếu peak angle vẫn lớn hơn hoặc bằng `60` độ thì báo `PEAK_CONTRACTION`.
- Nếu đang bị lean-back, detector bỏ qua một số phân tích lỗi tay để tránh cảnh báo nhiễu.

So với GymFixer: GymFixer đã có torso lean, elbow drift, ROM top/bottom, wrist angle, elbow flare, shoulder elevation và phase-aware feedback. Logic `weak peak contraction per rep` của repo kia đáng lấy vì GymFixer hiện chủ yếu phản hồi theo từng frame, chưa có nhiều lỗi tổng kết theo từng rep.

### Squat

File: `Exercise-Correction/web/server/detection/squat.py`

Nó dùng ML model để phân loại stage `up/down`, sau đó dùng rule để bắt lỗi chân/gối:

- Model `squat_model.pkl` dự đoán stage squat, confidence threshold `0.7`.
- Nếu model dự đoán `down` đủ confidence thì current stage là `down`.
- Nếu đang `down`, sau đó model dự đoán `up` đủ confidence thì tăng counter.
- Foot placement: đo tỉ lệ `foot_width / shoulder_width`.
  - Ngưỡng đúng: `1.2` đến `2.8`.
  - Nhỏ hơn là `feet too tight`, lớn hơn là `feet too wide`.
- Knee placement: đo tỉ lệ `knee_width / foot_width`, ngưỡng thay đổi theo stage:
  - `up`: `0.5` đến `1.0`
  - `middle`: `0.7` đến `1.0`
  - `down`: `0.7` đến `1.1`
- Chỉ phân tích knee placement nếu feet placement đang đúng.
- Chỉ lưu frame khi lỗi đổi trạng thái, tránh spam nhiều frame lỗi giống nhau.

So với GymFixer: GymFixer hiện có knee angle, hip angle và `knee_valgus_ratio`. Nó chưa có feedback rõ về stance quá hẹp/quá rộng theo `foot_width / shoulder_width`. Đây là phần dễ port nhất.

### Plank

File: `Exercise-Correction/web/server/detection/plank.py`

Plank là bài tĩnh nên nó dùng classification:

- Model `plank_model.pkl` + scaler.
- Important landmarks gồm vai, khuỷu, cổ tay, hông, gối, mắt cá, gót, mũi chân.
- Class:
  - `C` -> correct
  - `L` -> low back
  - `H` -> high back
  - còn lại -> unknown
- Confidence threshold `0.6`.
- Nếu chuyển sang `low back` hoặc `high back`, lưu frame lỗi một lần cho state đó.
- Không có rep count.

So với GymFixer: backend hiện có pushup/deadlift/shoulder_press angles nhưng chưa có plank. Plank có thể thêm như một exercise mới theo hướng rule trước, hoặc import model pickle sau khi kiểm tra độ tin cậy.

### Lunge

File: `Exercise-Correction/web/server/detection/lunge.py`

Lunge dùng hai model và một rule angle:

- `lunge_stage_model.pkl` dự đoán stage `I` init, `M` mid, `D` down.
- `lunge_err_model.pkl` phát hiện knee-over-toe error khi đang ở stage `down`.
- Dùng scaler `lunge_input_scaler.pkl`.
- Confidence threshold `0.8`.
- Rep count tăng khi stage chuyển từ `init` hoặc `mid` sang `down`.
- Knee-over-toe chỉ check ở `down`.
- Knee angle rule ở `down`: cả hai knee angle nên nằm trong `[60, 125]`; nếu ngoài range thì báo `knee angle`.
- Mỗi lỗi chỉ lưu một lần trong mỗi rep.

So với GymFixer: GymFixer đã có `get_lunge_angles()` và feedback tĩnh, nhưng chưa expose lunge trên frontend và chưa có phase/rep detector cho lunge. Logic stage `init/mid/down` và per-rep error suppression là hướng đáng học.

## 4. Điểm mạnh đáng học từ Exercise-Correction

1. Có bộ bài rộng hơn: bicep curl, squat, plank, lunge.
2. Có model artifacts và notebook training/evaluation trong `core/`.
3. Có cách lưu frame lỗi theo event/state, không lưu mọi frame xấu.
4. Có overlay video đã xử lý, dễ demo trực quan.
5. Một số lỗi cụ thể GymFixer có thể thiếu:
   - squat stance quá hẹp/quá rộng
   - squat knee width theo từng stage
   - bicep weak peak contraction theo từng rep
   - plank low-back/high-back
   - lunge knee-over-toe và knee angle per rep

## 5. Hạn chế nếu bê nguyên vào GymFixer

Không nên import nguyên pipeline Django/Vue vào GymFixer. Lý do:

- GymFixer đã có FastAPI + Next.js + PostgreSQL, không cần thêm Django/Vue.
- Repo kia dùng pickle model từ project ngoài. Pickle là format cần tin nguồn tuyệt đối khi load, vì load pickle có thể thực thi code Python. Nếu dùng, nên copy artifact có kiểm soát, pin source, hoặc retrain/export sang format an toàn hơn.
- Model được train trên dataset nhỏ/tự thu, có thể lệch với camera, body type và môi trường mới.
- Nó resize video về 40%, ghi video mp4 và static image vào filesystem. GymFixer hiện không lưu uploaded video/base64 preview trong database, nên cần thiết kế storage riêng nếu muốn processed video.
- Không có subject-ready gate. Với video người đi vào khung hình, dễ phát hiện nhầm trước khi user sẵn sàng.
- Không có abstraction pose backend. Logic của repo kia phụ thuộc MediaPipe 33 landmarks; nếu dùng ViTPose COCO-17 thì một số rule/model sẽ thiếu landmarks như heel, foot index, index finger.

## 6. Hướng phát triển GymFixer từ repo này

### Ưu tiên 1: Port rule đơn giản, không cần model

Đây là hướng rẻ và an toàn nhất.

1. Thêm squat stance metrics vào `backend/posture/mediapipe_utils.py`:
   - `foot_shoulder_ratio`
   - `knee_foot_ratio`
   - có thể chỉ bật khi `camera_view=front` hoặc `three_quarter`
2. Thêm feedback trong `backend/posture/feedback.py`:
   - feet too narrow/wide
   - knees tracking too narrow/wide relative to feet
3. Thêm bicep per-rep summary:
   - track peak elbow angle trong mỗi rep
   - nếu peak vẫn quá cao thì báo “finish the curl higher”
   - hiện feedback có cue tương tự ở `CONTRACTED`, nhưng nên tổng kết theo rep để giảm nhiễu frame-by-frame.

Ưu điểm: giữ pipeline hiện tại, không thêm dependency, vẫn chạy cả MediaPipe/ViTPose nếu metric đủ landmark.

### Ưu tiên 2: Expose lunge trong GymFixer

Backend hiện đã có angle và feedback cho lunge, nên có thể mở frontend sau khi bổ sung:

1. Thêm `lunge` vào `ExerciseId` và dashboard selector.
2. Thêm visibility gate cho lunge trong `backend/posture/mediapipe_utils.py`.
3. Thêm `PhaseDetector("lunge")` với phase đơn giản:
   - `STANDING/INIT`
   - `DESCENDING/MID`
   - `BOTTOM/DOWN`
   - `ASCENDING`
4. Rep count tăng khi hoàn thành chu kỳ về đứng, không nên tăng ngay khi xuống `down` như repo kia nếu muốn thống nhất UX với squat/curl.
5. Thêm preview feedback cho knee angle và torso lean.

Sau đó mới cân nhắc knee-over-toe model.

### Ưu tiên 3: Thêm plank như bài tĩnh

Plank hợp với GymFixer vì không cần rep detector:

1. Thêm `plank` vào exercise list.
2. Thêm `get_plank_angles()`:
   - body line shoulder-hip-ankle
   - hip sag/pike ratio hoặc body angle
   - elbow/shoulder support angle nếu cần
3. Thêm feedback:
   - hips too low
   - hips too high
   - keep head/hips/heels aligned
4. Summary dùng duration/usable frames thay vì rep count.

Model plank từ `Exercise-Correction` có thể dùng làm baseline tham khảo, nhưng rule-based trước sẽ hợp với architecture hiện tại hơn.

### Ưu tiên 4: ML classifier plugin, nếu thật sự cần

Nếu muốn tận dụng `.pkl`:

1. Tạo module riêng, ví dụ:

```text
backend/posture/classifiers/
  base.py
  sklearn_pose_classifier.py
  exercise_correction_models.py
```

2. Classifier chỉ nhận normalized landmark vector và trả:

```json
{
  "label": "low back",
  "confidence": 0.82,
  "source": "exercise_correction_plank_model"
}
```

3. Không để classifier thay thế pipeline chính. Nó chỉ là signal phụ cho feedback:

```text
pose backend -> gates -> angles -> phase -> rules
                                  -> optional classifier signals
                                  -> feedback + summary + LLM
```

4. Cần mapping rõ theo từng model:
   - important landmarks
   - scaler path
   - expected columns
   - label mapping
   - confidence threshold

5. Nên ghi version/source model trong `analysis_results.summary_json` để debug.

## 7. Đề xuất roadmap thực tế

### Phase A: Nâng chất lượng squat/curl hiện tại

- Port squat stance ratios từ `Exercise-Correction`.
- Thêm per-rep issue aggregation cho curl ROM/peak contraction.
- Thêm unit test cho angle metrics và feedback thresholds.
- Giữ frontend vẫn chỉ có squat/curl.

### Phase B: Mở rộng bài tập

- Expose lunge ở frontend.
- Bổ sung lunge visibility gate và phase detector.
- Thêm plank rule-based.
- Update analytics để không giả định bài nào cũng có reps.

### Phase C: Optional ML

- Đánh giá model `.pkl` trên vài video thật của GymFixer.
- Nếu ổn, thêm classifier layer sau gates.
- Nếu không ổn, dùng notebook trong `core/` làm reference để retrain bằng dataset mới.

### Phase D: Processed video/overlay

GymFixer hiện trả mistake preview frames, chưa trả video processed đầy đủ. Nếu muốn giống demo repo kia:

- Thêm option `include_processed_video`.
- Lưu file vào object storage hoặc thư mục media có cleanup policy.
- Không lưu trực tiếp vào PostgreSQL.
- Trả URL processed video trong response/session detail.

## 8. Kết luận

`Exercise-Correction` đáng dùng làm reference về exercise-specific logic và model training, nhưng không nên nhập nguyên stack. Cách hợp nhất tốt nhất là giữ kiến trúc GymFixer hiện tại, rồi port từng capability nhỏ:

- squat stance ratios trước
- curl per-rep peak contraction
- lunge phase/rep detector
- plank rule-based support
- optional classifier layer sau khi đã kiểm thử model

Như vậy GymFixer vẫn giữ được các phần mạnh hiện tại: auth, history/analytics, subject-ready gate, pose backend switch, Gemini coaching và UI after-session analysis; đồng thời học được các lỗi form cụ thể từ repo vừa clone.
