"""Write triage.xes: hand-made cases for the invoice-triage labels.
Expected labels are in triage_key.json, worked out by hand.
Run: python tests/fixtures/make_triage.py
"""
from pathlib import Path
from make_fixtures import write, case, IBG, IAG, CREATE, GR, IR, RPB, CLR, CP

HERE = Path(__file__).parent
CIR = "Cancel Invoice Receipt"
DEBIT = "Vendor creates debit memo"
SPB = "Set Payment Block"

TRIAGE = [
    # Fitting months (Jan-May 2018)
    case("T01_00001", IBG, "va", [(CREATE, "user_001", "2018-03-01T10:00:00", 10.0), (IR, "user_002", "2018-03-02T10:00:00", 10.0),
        (GR, "user_001", "2018-03-03T10:00:00", 10.0), (RPB, "batch_01", "2018-03-04T10:00:00", 10.0), (CLR, "user_003", "2018-03-10T10:00:00", 10.0)], vendor="vendor_A"),
    case("T02_00001", IBG, "vb", [(CREATE, "user_001", "2018-04-01T10:00:00", 20.0), (IR, "user_002", "2018-04-02T10:00:00", 20.0),
        (CP, "user_004", "2018-04-03T10:00:00", 25.0), (CLR, "user_003", "2018-04-10T10:00:00", 25.0)], vendor="vendor_B"),
    case("T03_00001", IAG, "vb", [(CREATE, "user_001", "2018-05-01T10:00:00", 30.0), (IR, "user_002", "2018-05-02T10:00:00", 30.0),
        (CIR, "user_002", "2018-05-03T10:00:00", 30.0), (IR, "user_002", "2018-05-04T10:00:00", 30.0), (CLR, "user_003", "2018-05-10T10:00:00", 30.0)], vendor="vendor_B"),
    case("T09_00001", IAG, "va", [(CREATE, "user_001", "2018-02-01T10:00:00", 90.0), (GR, "user_001", "2018-02-02T10:00:00", 90.0),
        (CLR, "user_003", "2018-02-10T10:00:00", 90.0)], vendor="vendor_A"),
    # Held-out months (Jun-Aug 2018)
    case("T04_00001", IAG, "va", [(CREATE, "user_001", "2018-06-01T10:00:00", 40.0), (GR, "user_001", "2018-06-02T10:00:00", 40.0),
        (IR, "user_002", "2018-06-03T10:00:00", 40.0), (CLR, "user_003", "2018-06-10T10:00:00", 40.0),
        (CP, "user_004", "2018-06-12T10:00:00", 41.0)], vendor="vendor_A"),  # correction after clearing: label unchanged
    case("T05_00001", IBG, "vb", [(CREATE, "user_001", "2018-07-01T10:00:00", 50.0), (IR, "user_002", "2018-07-02T10:00:00", 50.0),
        (DEBIT, "NONE", "2018-07-03T10:00:00", 50.0), (CLR, "user_003", "2018-07-10T10:00:00", 50.0)], vendor="vendor_B"),
    case("T06_00001", IBG, "va", [(CREATE, "user_001", "2018-08-01T10:00:00", 60.0), (IR, "user_002", "2018-08-02T10:00:00", 60.0)], vendor="vendor_A"),
    case("T07_00001", IBG, "va", [(CREATE, "user_001", "2018-07-05T10:00:00", 70.0), (CP, "user_004", "2018-07-06T10:00:00", 75.0),
        (IR, "user_002", "2018-07-07T10:00:00", 75.0), (GR, "user_001", "2018-07-08T10:00:00", 75.0), (CLR, "user_003", "2018-07-15T10:00:00", 75.0)], vendor="vendor_A"),
    case("T10_00001", IBG, "vb", [(CREATE, "user_001", "2018-08-05T10:00:00", 100.0), (IR, "user_002", "2018-08-06T10:00:00", 100.0),
        (SPB, "user_005", "2018-08-07T10:00:00", 100.0), (CLR, "user_003", "2018-08-20T10:00:00", 100.0)], vendor="vendor_B"),
    # Left out: created from Sep 2018 (outcomes not reliably observable)
    case("T08_00001", IBG, "va", [(CREATE, "user_001", "2018-09-03T10:00:00", 80.0), (IR, "user_002", "2018-09-04T10:00:00", 80.0),
        (CLR, "user_003", "2018-09-10T10:00:00", 80.0)], vendor="vendor_A"),
]

if __name__ == "__main__":
    write(HERE / "triage.xes", TRIAGE)
    print("wrote triage.xes")
