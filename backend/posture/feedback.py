"""Exercise feedback generators.

Squat and bicep curl use phase-aware feedback (different cues depending on
where in the movement the user currently is). Other exercises use simple
threshold-based feedback unchanged from the original implementation.
"""

from __future__ import annotations

import os


def _normalise_camera_view(camera_view: str | None) -> str:
    value = (camera_view or "side").strip().lower().replace("-", "_")
    aliases = {
        "45": "three_quarter",
        "45_degree": "three_quarter",
        "three_quarter": "three_quarter",
        "quarter": "three_quarter",
        "front": "front",
        "side": "side",
    }
    return aliases.get(value, "side")


# ---------------------------------------------------------------------------
# Squat — phase-aware
# ---------------------------------------------------------------------------

def generate_squat_feedback(angles: dict, phase: str | None = None) -> list[str]:
    """Generate cue-specific squat feedback based on current movement phase.

    Phases: STANDING | DESCENDING | BOTTOM | ASCENDING
    When phase is None (no phase detector active), falls back to static checks.
    """
    feedback: list[str] = []

    rk = angles.get('right_knee')
    lk = angles.get('left_knee')
    rh = angles.get('right_hip')
    lh = angles.get('left_hip')
    valgus = angles.get('knee_valgus_ratio')  # <1.0 = knees caving in

    # --- Phase-specific cues ---
    if phase == "DESCENDING":
        # Cue form as they go down
        if rh is not None and lh is not None:
            if min(rh, lh) < 60:
                feedback.append("Keep your chest up and back straight as you lower.")
        if valgus is not None and valgus < 0.80:
            feedback.append("Push your knees out — they're caving in.")
        if not feedback:
            feedback.append("Good descent — control the movement.")

    elif phase == "BOTTOM":
        # Check depth and knee health at the bottom
        if rk is not None and lk is not None:
            avg_knee = (rk + lk) / 2.0
            if avg_knee > 110:
                feedback.append("Go a bit deeper — aim for thighs parallel to the floor.")
            elif avg_knee < 60:
                feedback.append("That's very deep — ensure knees stay comfortable.")
        if valgus is not None and valgus < 0.80:
            feedback.append("Drive your knees outward at the bottom.")
        if rh is not None and lh is not None:
            if min(rh, lh) < 55:
                feedback.append("Maintain a neutral spine — avoid rounding your lower back.")
        if not feedback:
            feedback.append("Great depth! Drive up through your heels.")

    elif phase == "ASCENDING":
        if valgus is not None and valgus < 0.80:
            feedback.append("Keep knees pushed out as you drive up.")
        if rh is not None and lh is not None:
            if min(rh, lh) < 60:
                feedback.append("Chest up — don't let your torso collapse forward.")
        if not feedback:
            feedback.append("Strong drive — almost there!")

    elif phase == "STANDING":
        # At the top — prep cue or celebrate rep
        feedback.append("Good rep! Brace your core before the next descent.")

    else:
        # Fallback: static threshold checks (no phase context)
        if rk is not None and lk is not None:
            if max(rk, lk) > 100:
                feedback.append("Bend your knees more to reach proper squat depth.")
            if min(rk, lk) < 60:
                feedback.append("You're going too low — keep knees above 60°.")
        if rh is not None and lh is not None:
            if min(rh, lh) < 70:
                feedback.append("Keep your back straighter to protect your spine.")
        if valgus is not None and valgus < 0.80:
            feedback.append("Watch your knees — they're caving inward.")
        if not feedback:
            feedback.append("Excellent squat! Keep that form.")

    return feedback


# ---------------------------------------------------------------------------
# Bicep curl — phase-aware
# ---------------------------------------------------------------------------

def generate_bicep_curl_feedback(
    angles: dict,
    phase: str | None = None,
    camera_view: str | None = "side",
) -> list[str]:
    """Generate cue-specific bicep curl feedback based on current phase.

    Phases: EXTENDED | CURLING | CONTRACTED | LOWERING
    """
    feedback: list[str] = []
    view = _normalise_camera_view(camera_view)
    side_like = view in {"side", "three_quarter"}
    front_like = view in {"front", "three_quarter"}

    elbows = [
        value
        for value in (angles.get('right_elbow'), angles.get('left_elbow'))
        if value is not None
    ]
    max_elbow = max(elbows) if elbows else None
    min_elbow = min(elbows) if elbows else None
    max_drift = max(
        angles.get('elbow_drift', 0.0),
        angles.get('right_elbow_drift', 0.0),
        angles.get('left_elbow_drift', 0.0),
    )
    torso_lean = angles.get('torso_lean')
    wrist_angle = angles.get('wrist_angle')
    elbow_flare = angles.get('elbow_flare_angle')
    shoulder_elevation = angles.get('shoulder_elevation_ratio')

    DRIFT_THRESH = float(os.getenv("POSTURE_CURL_ELBOW_DRIFT_THRESH", "0.40"))
    TORSO_LEAN_THRESH = float(os.getenv("POSTURE_CURL_TORSO_LEAN_THRESH", "14.0"))
    TOP_ROM_THRESH = float(os.getenv("POSTURE_CURL_TOP_ROM_THRESH", "80.0"))
    BOTTOM_ROM_THRESH = float(os.getenv("POSTURE_CURL_BOTTOM_ROM_THRESH", "150.0"))
    WRIST_FLEXION_THRESH = float(os.getenv("POSTURE_CURL_WRIST_FLEXION_THRESH", "150.0"))
    ELBOW_FLARE_THRESH = float(os.getenv("POSTURE_CURL_ELBOW_FLARE_THRESH", "32.0"))
    SHOULDER_ELEVATION_THRESH = float(os.getenv("POSTURE_CURL_SHOULDER_ELEVATION_THRESH", "0.38"))

    def add_wrist_cue() -> None:
        if wrist_angle is not None and wrist_angle < WRIST_FLEXION_THRESH:
            feedback.append("Keep your wrist neutral — don't curl the weight with your forearm.")

    def add_side_momentum_cues() -> None:
        if torso_lean is not None and torso_lean > TORSO_LEAN_THRESH:
            feedback.append("Keep your torso upright — don't lean back to curl the weight.")
        if max_drift > DRIFT_THRESH:
            feedback.append("Keep your elbows pinned to your sides — don't let them travel forward.")

    def add_front_stability_cues() -> None:
        if shoulder_elevation is not None and shoulder_elevation < SHOULDER_ELEVATION_THRESH:
            feedback.append("Relax your traps — don't shrug your shoulders during the curl.")
        if elbow_flare is not None and elbow_flare > ELBOW_FLARE_THRESH:
            feedback.append("Keep your elbows tucked — don't flare them out to the side.")

    if phase == "CURLING":
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Curl up — squeeze at the top!")

    elif phase == "CONTRACTED":
        if max_elbow is not None and max_elbow > TOP_ROM_THRESH:
            feedback.append("Finish the curl higher — don't stop short at the top.")
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Great contraction! Now lower slowly.")

    elif phase == "LOWERING":
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Good control on the way down.")

    elif phase == "EXTENDED":
        if min_elbow is not None and min_elbow < BOTTOM_ROM_THRESH:
            feedback.append("Lower to full elbow extension before starting the next rep.")
        add_wrist_cue()
        if not feedback:
            feedback.append("Arms extended — ready for the next curl.")

    else:
        # Fallback static checks
        if max_elbow is not None and max_elbow > 165:
            feedback.append("Use a controlled curl — don't just hang at the bottom.")
        if min_elbow is not None and min_elbow < 40:
            feedback.append("Avoid over-curling; keep tension and control at the top.")
        if side_like:
            add_side_momentum_cues()
        if front_like:
            add_front_stability_cues()
        add_wrist_cue()
        if not feedback:
            feedback.append("Nice curls — controlled tempo and full range.")

    return feedback


# ---------------------------------------------------------------------------
# Remaining exercises — unchanged static feedback
# ---------------------------------------------------------------------------

def generate_lunge_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get('right_knee', 180) > 150 and angles.get('left_knee', 180) > 150:
        feedback.append("Bend your front knee more to lower into the lunge.")
    if angles.get('right_knee', 0) < 50 or angles.get('left_knee', 0) < 50:
        feedback.append("Avoid dropping too low; control your depth.")
    if angles.get('torso_angle', 180) < 70:
        feedback.append("Keep your torso more upright; avoid leaning forward.")
    if not feedback:
        feedback.append("Good lunge form. Keep it controlled.")
    return feedback


def generate_deadlift_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get('right_back', 180) < 140 or angles.get('left_back', 180) < 140:
        feedback.append("Keep your back straighter; hinge at the hips, not the spine.")
    if angles.get('right_hip', 180) < 30 or angles.get('left_hip', 180) < 30:
        feedback.append("Drive the movement with your hips; push them back.")
    if angles.get('right_knee', 0) < 120 or angles.get('left_knee', 0) < 120:
        feedback.append("Don't bend your knees too much; maintain a slight bend.")
    if not feedback:
        feedback.append("Nice deadlift posture — maintain the hip hinge and straight back.")
    return feedback


def generate_pushup_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get('body_angle', 180) < 160:
        feedback.append("Keep your body straight from head to heels.")
    if angles.get('right_elbow', 180) > 160 and angles.get('left_elbow', 180) > 160:
        feedback.append("Lower your chest more to increase muscle engagement.")
    if angles.get('right_elbow', 0) < 60 or angles.get('left_elbow', 0) < 60:
        feedback.append("Control the descent; don't drop too quickly.")
    if not feedback:
        feedback.append("Good pushup form — full range and a straight body.")
    return feedback


def generate_shoulder_press_feedback(angles: dict, phase: str | None = None) -> list[str]:
    feedback: list[str] = []
    if not angles:
        return ["Please get fully into the frame."]
    if angles.get('right_elbow', 0) < 160 or angles.get('left_elbow', 0) < 160:
        feedback.append("Extend your arms fully at the top for full lockout.")
    if angles.get('right_shoulder_abd', 180) < 60 or angles.get('left_shoulder_abd', 180) < 60:
        feedback.append("Keep your elbows in line and press vertically.")
    if not feedback:
        feedback.append("Good shoulder press — stable torso and full extension.")
    return feedback


# ---------------------------------------------------------------------------
# Dispatch
# ---------------------------------------------------------------------------

_FEEDBACK_FN = {
    'squat':          generate_squat_feedback,
    'lunge':          generate_lunge_feedback,
    'deadlift':       generate_deadlift_feedback,
    'pushup':         generate_pushup_feedback,
    'shoulder_press': generate_shoulder_press_feedback,
    'bicep_curl':     generate_bicep_curl_feedback,
}


def generate_feedback(
    exercise: str,
    angles: dict,
    phase: str | None = None,
    camera_view: str | None = "side",
) -> list[str]:
    """Generate feedback for the given exercise, angles, and optional phase context."""
    fn = _FEEDBACK_FN.get(exercise)
    if fn is None:
        return ["Exercise not supported yet."]
    if exercise == 'bicep_curl':
        return fn(angles, phase=phase, camera_view=camera_view)
    return fn(angles, phase=phase)
