import { Language } from "@/lib/i18n";

const VI_FEEDBACK: Record<string, string> = {
  "Exercise not supported yet.": "Bài tập này chưa được hỗ trợ.",
  "Please get fully into the frame.": "Hãy đưa toàn bộ cơ thể vào khung hình.",
  "Frame could not be decoded.": "Không thể đọc khung hình này.",
  "No person detected.": "Không phát hiện người trong khung hình.",
  "Your stance is too narrow - set your feet closer to shoulder width.": "Tư thế chân quá hẹp - đặt hai chân gần bằng độ rộng vai.",
  "Your stance is too wide - bring your feet closer to shoulder width.": "Tư thế chân quá rộng - thu hai chân lại gần bằng độ rộng vai.",
  "Push your knees out - they're caving in.": "Đẩy gối ra ngoài - gối đang bị đổ vào trong.",
  "Your knees are too wide - keep them tracking over your feet.": "Gối đang mở quá rộng - giữ gối đi theo hướng bàn chân.",
  "Keep your chest up - avoid letting your torso collapse forward.": "Giữ ngực mở lên - tránh để thân người gập đổ về phía trước.",
  "Keep your chest up and back straight as you lower.": "Giữ ngực mở và lưng thẳng khi hạ người.",
  "Good descent - control the movement.": "Pha hạ tốt - tiếp tục kiểm soát chuyển động.",
  "Go deeper - aim for thighs parallel to the floor.": "Xuống sâu hơn - hướng tới đùi song song với sàn.",
  "You're going too low - keep your knees comfortable.": "Bạn đang xuống quá thấp - giữ đầu gối trong biên độ thoải mái.",
  "Great depth! Drive up through your heels.": "Độ sâu tốt! Đẩy lên qua gót chân.",
  "Strong drive - almost there!": "Pha đẩy lên tốt - gần hoàn thành rồi.",
  "Good rep! Brace your core before the next descent.": "Rep tốt! Siết core trước lần hạ tiếp theo.",
  "Bend your knees more to reach proper squat depth.": "Gập gối nhiều hơn để đạt độ sâu squat phù hợp.",
  "Excellent squat! Keep that form.": "Squat rất tốt! Giữ form này.",
  "Complete the rep - reach squat depth before standing up.": "Hoàn thành rep - đạt độ sâu squat trước khi đứng lên.",
  "Keep your torso upright - don't lean back to curl the weight.": "Giữ thân người thẳng - đừng ngả lưng để kéo tạ.",
  "Keep your elbows pinned to your sides - don't let them travel forward.": "Giữ khuỷu tay sát thân - đừng để khuỷu trôi ra trước.",
  "Relax your traps - don't shrug your shoulders during the curl.": "Thả lỏng cầu vai - đừng nhún vai khi curl.",
  "Keep your elbows tucked - don't flare them out to the side.": "Giữ khuỷu tay gọn vào trong - đừng xòe khuỷu sang hai bên.",
  "Curl up - squeeze at the top!": "Cuốn tạ lên - siết mạnh ở đỉnh động tác!",
  "Finish the curl higher - don't stop short at the top.": "Cuốn tạ cao hơn - đừng dừng quá sớm ở đỉnh.",
  "Great contraction! Now lower slowly.": "Siết cơ tốt! Bây giờ hạ xuống chậm.",
  "Good control on the way down.": "Kiểm soát tốt ở pha hạ.",
  "Lower to full elbow extension before starting the next rep.": "Hạ tới khi khuỷu duỗi đủ trước khi bắt đầu rep tiếp theo.",
  "Arms extended - ready for the next curl.": "Tay đã duỗi - sẵn sàng cho lần curl tiếp theo.",
  "Use a controlled curl - don't just hang at the bottom.": "Curl có kiểm soát - đừng thả lỏng ở đáy động tác.",
  "Avoid over-curling; keep tension and control at the top.": "Tránh cuốn quá cao; giữ lực căng và kiểm soát ở đỉnh.",
  "Nice curls - controlled tempo and full range.": "Curl tốt - nhịp độ kiểm soát và đủ biên độ.",
  "Go deeper - lower until your front knee reaches a stronger lunge angle.": "Xuống sâu hơn - hạ tới khi gối trước đạt góc lunge tốt hơn.",
  "Avoid dropping too low - keep your front knee under control.": "Tránh hạ quá thấp - giữ gối trước trong tầm kiểm soát.",
  "Avoid dropping too low - keep your back knee controlled above the floor.": "Tránh hạ quá thấp - kiểm soát gối sau ở trên sàn.",
  "Keep your torso upright - avoid leaning forward during the lunge.": "Giữ thân người thẳng - tránh đổ người về trước khi lunge.",
  "Avoid letting your front knee travel too far past your toes.": "Tránh để gối trước vượt quá xa mũi chân.",
  "Lower under control - go deeper before driving back up.": "Hạ có kiểm soát - xuống sâu hơn trước khi đẩy lên.",
  "Good descent - keep the lunge controlled.": "Pha hạ tốt - giữ lunge có kiểm soát.",
  "Good lunge depth - drive back up through your front foot.": "Độ sâu lunge tốt - đẩy lên qua bàn chân trước.",
  "Strong drive - return to standing with control.": "Pha đẩy tốt - trở lại đứng với kiểm soát.",
  "Reset tall before the next lunge.": "Đứng thẳng và reset trước lần lunge tiếp theo.",
  "Good lunge form. Keep it controlled.": "Form lunge tốt. Tiếp tục kiểm soát.",
  "Complete the rep - lower into the lunge before standing up.": "Hoàn thành rep - hạ vào tư thế lunge trước khi đứng lên.",
  "Move fully into frame so one complete side of your body and both hands are visible.": "Di chuyển vào khung hình để thấy rõ một bên cơ thể và cả hai tay.",
  "Record Romanian deadlifts from the side so hip hinge and bar path can be assessed.": "Hãy quay Romanian deadlift từ góc ngang để đánh giá hip hinge và đường đi của tạ.",
  "Your upper-back and neck alignment may be rounding - keep a long neutral spine; this is a pose-based cue, not a spinal diagnosis.": "Lưng trên và cổ có thể đang bị cong - giữ cột sống trung lập và kéo dài; đây là gợi ý theo tư thế, không phải chẩn đoán cột sống.",
  "Avoid turning the hinge into a squat - keep only a soft bend in your knees.": "Tránh biến hip hinge thành squat - chỉ gập nhẹ đầu gối.",
  "Keep the bar close to your legs - let your hands travel near your thighs and shins.": "Giữ tạ sát chân - để tay đi gần đùi và ống chân.",
  "Avoid leaning back at lockout - finish tall with your ribs stacked over your hips.": "Tránh ngả lưng ở lockout - kết thúc thẳng người, xương sườn nằm trên hông.",
  "Good lockout - reset tall before the next hinge.": "Lockout tốt - đứng thẳng reset trước lần hinge tiếp theo.",
  "Good hip hinge - keep the bar close and move with control.": "Hip hinge tốt - giữ tạ sát người và di chuyển có kiểm soát.",
  "Good Romanian deadlift position.": "Tư thế Romanian deadlift tốt.",
  "Complete the rep - hinge deeper before returning to standing.": "Hoàn thành rep - hinge sâu hơn trước khi đứng thẳng lại.",
};

function normalizeFeedbackText(text: string) {
  return text.replace(/[—–]/g, "-").replace(/\s+/g, " ").trim();
}

export function translateFeedbackText(text: string, language: Language) {
  if (language !== "vi") return text;
  const normalized = normalizeFeedbackText(text);

  if (normalized.startsWith("Hold still - starting analysis in ")) {
    return normalized
      .replace("Hold still - starting analysis in ", "Giữ yên - bắt đầu phân tích sau ")
      .replace(" more stable frames.", " khung hình ổn định nữa.");
  }

  if (normalized.startsWith("Move into frame - can't see: ")) {
    return normalized.replace("Move into frame - can't see: ", "Di chuyển vào khung hình - chưa thấy rõ: ");
  }

  if (normalized.startsWith("Move fully into frame - ")) {
    return normalized.replace("Move fully into frame - ", "Di chuyển toàn bộ cơ thể vào khung hình - ");
  }

  return VI_FEEDBACK[normalized] || text;
}
