from posture.phase_detector import PhaseDetector


def test_bicep_curl_counts_one_visible_working_arm_with_other_arm_static():
    detector = PhaseDetector("bicep_curl")

    samples = [
        (160, 170),
        (130, 170),
        (90, 170),
        (130, 170),
    ]

    for left_elbow, right_elbow in samples:
        phase, reps = detector.update(
            {"left_elbow": left_elbow, "right_elbow": right_elbow}
        )

    assert phase == "EXTENDED"
    assert reps == 1


def test_bicep_curl_counts_sparse_contract_to_extend_transition():
    detector = PhaseDetector("bicep_curl")

    for elbow_angle in [160, 95, 160, 95, 160]:
        phase, reps = detector.update({"left_elbow": elbow_angle})

    assert phase == "EXTENDED"
    assert reps == 2
