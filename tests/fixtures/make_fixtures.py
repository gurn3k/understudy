"""Write the two fixture logs in the real BPI 2019 XES shape.

The cases below are written by hand. The expected figures live in
answer_key.json and are worked out by hand from this list, not by code.
Run: python tests/fixtures/make_fixtures.py
"""
from pathlib import Path
from xml.sax.saxutils import quoteattr

HERE = Path(__file__).parent
TZ = ".000Z"

IBG = "3-way match, invoice before GR"
IAG = "3-way match, invoice after GR"
TWO = "2-way match"

CREATE = "Create Purchase Order Item"
GR = "Record Goods Receipt"
IR = "Record Invoice Receipt"
VCI = "Vendor creates invoice"
RPB = "Remove Payment Block"
CLR = "Clear Invoice"
CP = "Change Price"


def case(cid, category, vendor_name, events, vendor="vendorID_0001"):
    return {"id": cid, "category": category, "vendor": vendor,
            "name": vendor_name, "events": events}


# (activity, user, timestamp without zone, cumulative net worth)
PLANTED = [
    # P1: normal invoice-before-GR flow; vendor name needs XML escaping.
    case("4500000001_00001", IBG, "Smith & Sons <Ltd>", [
        (CREATE, "user_001", "2018-03-01T10:00:00", 100.0),
        (VCI, "NONE", "2018-03-02T10:00:00", 100.0),
        (IR, "user_002", "2018-03-03T10:00:00", 100.0),
        (GR, "user_001", "2018-03-05T10:00:00", 100.0),
        (RPB, "batch_01", "2018-03-06T10:00:00", 100.0),
        (CLR, "batch_02", "2018-03-20T10:00:00", 100.0),
    ]),
    # P2: price changed twice by a person (a true repeat); block removed by a person.
    case("4500000002_00001", IBG, "vendor_0002", [
        (CREATE, "user_001", "2018-04-01T10:00:00", 200.0),
        (CP, "user_003", "2018-04-02T10:00:00", 210.0),
        (CP, "user_003", "2018-04-04T10:00:00", 220.0),
        (GR, "user_001", "2018-04-05T10:00:00", 220.0),
        (IR, "user_002", "2018-04-06T10:00:00", 220.0),
        (RPB, "user_004", "2018-04-07T10:00:00", 220.0),
        (CLR, "batch_02", "2018-04-20T10:00:00", 220.0),
    ]),
    # P3: one goods receipt dated 1948 (excluded event).
    case("4500000003_00001", IAG, "vendor_0003", [
        (CREATE, "user_001", "2018-05-01T10:00:00", 300.0),
        (GR, "user_001", "1948-01-26T10:00:00", 300.0),
        (IR, "user_002", "2018-05-03T10:00:00", 300.0),
        (CLR, "batch_02", "2018-05-10T10:00:00", 300.0),
    ]),
    # P4: an exact duplicate goods receipt (one copy excluded).
    case("4500000004_00001", IAG, "vendor_0004", [
        (CREATE, "user_005", "2018-06-01T10:00:00", 400.0),
        (GR, "user_001", "2018-06-02T10:00:00", 400.0),
        (GR, "user_001", "2018-06-02T10:00:00", 400.0),
        (IR, "user_002", "2018-06-03T10:00:00", 400.0),
        (CLR, "batch_02", "2018-06-15T10:00:00", 400.0),
    ]),
    # P5: no creation event (whole case excluded).
    case("4500000005_00001", IAG, "vendor_0005", [
        (GR, "user_001", "2018-07-02T10:00:00", 500.0),
        (IR, "user_002", "2018-07-03T10:00:00", 500.0),
        (CLR, "batch_02", "2018-07-10T10:00:00", 500.0),
    ]),
    # P6: creation by an unnamed resource (unclassified).
    case("4500000006_00001", IAG, "vendor_0006", [
        (CREATE, "NONE", "2018-08-01T10:00:00", 600.0),
        (GR, "user_001", "2018-08-02T10:00:00", 600.0),
        (IR, "user_002", "2018-08-03T10:00:00", 600.0),
        (CLR, "batch_02", "2018-08-10T10:00:00", 600.0),
    ]),
    # P7: partial deliveries and invoices: repeats that are not rework.
    #     The file lists one goods receipt out of time order.
    case("4500000007_00001", IAG, "vendor_0007", [
        (CREATE, "user_001", "2018-09-01T10:00:00", 300.0),
        (GR, "user_001", "2018-09-05T10:00:00", 300.0),  # out of time order in the file
        (GR, "user_001", "2018-09-02T10:00:00", 100.0),
        (IR, "user_002", "2018-09-03T10:00:00", 100.0),
        (IR, "user_002", "2018-09-06T10:00:00", 300.0),
        (CLR, "batch_02", "2018-09-20T10:00:00", 300.0),
    ]),
    # P8: batch removed the payment block before any goods receipt (batch was wrong).
    #     The invoice also arrives before the item was created (flagged, kept).
    case("4500000008_00001", IBG, "vendor_0008", [
        (IR, "user_002", "2018-09-30T10:00:00", 800.0),
        (CREATE, "user_001", "2018-10-01T10:00:00", 800.0),
        (RPB, "batch_01", "2018-10-03T10:00:00", 800.0),
        (GR, "user_001", "2018-10-10T10:00:00", 800.0),
        (CLR, "batch_02", "2018-10-15T10:00:00", 800.0),
    ]),
    # P9: a person removed the payment block and no goods receipt ever came.
    case("4500000009_00001", IBG, "vendor_0009", [
        (CREATE, "user_001", "2018-11-01T10:00:00", 900.0),
        (IR, "user_002", "2018-11-02T10:00:00", 900.0),
        (RPB, "user_004", "2018-11-03T10:00:00", 900.0),
        (CLR, "batch_02", "2018-11-20T10:00:00", 900.0),
    ]),
    # P10: early block removal outside the invoice-before-GR flow (not flagged).
    case("4500000010_00001", IAG, "vendor_0010", [
        (CREATE, "user_001", "2018-11-05T10:00:00", 1000.0),
        (RPB, "batch_01", "2018-11-06T10:00:00", 1000.0),
        (GR, "user_001", "2018-11-07T10:00:00", 1000.0),
        (IR, "user_002", "2018-11-08T10:00:00", 1000.0),
        (CLR, "batch_02", "2018-11-25T10:00:00", 1000.0),
    ]),
]

CLEAN = [
    case("4500000101_00001", IAG, "vendor_0101", [
        (CREATE, "user_010", "2018-02-01T10:00:00", 50.0),
        (GR, "user_010", "2018-02-03T10:00:00", 50.0),
        (IR, "user_011", "2018-02-04T10:00:00", 50.0),
        (CLR, "batch_02", "2018-02-15T10:00:00", 50.0),
    ]),
    case("4500000102_00001", TWO, "vendor_0102", [
        (CREATE, "user_010", "2018-02-05T10:00:00", 60.0),
        (IR, "user_011", "2018-02-07T10:00:00", 60.0),
        (CLR, "batch_02", "2018-02-20T10:00:00", 60.0),
    ]),
    case("4500000103_00001", IBG, "vendor_0103", [
        (CREATE, "user_010", "2018-02-10T10:00:00", 70.0),
        (IR, "user_011", "2018-02-11T10:00:00", 70.0),
        (GR, "user_010", "2018-02-12T10:00:00", 70.0),
        (RPB, "batch_01", "2018-02-13T10:00:00", 70.0),
        (CLR, "batch_02", "2018-02-25T10:00:00", 70.0),
    ]),
]

HEADER = """<?xml version="1.0" encoding="UTF-8" ?>
<log xes.version="1849.2016" xes.features="">
<global scope="event"><string key="concept:name" value="UNKNOWN"></string><date key="time:timestamp" value="1970-01-01T00:00:00.000Z"></date><string key="org:resource" value="UNKNOWN"></string><string key="User" value="UNKNOWN"></string><float key="Cumulative net worth (EUR)" value="0.0"></float></global>
<string key="concept:name" value="BPI Challenge 2019"></string>
"""


def s(key, value):
    return f"<string key={quoteattr(key)} value={quoteattr(value)}></string>"


def write(path, cases):
    out = [HEADER]
    for c in cases:
        po, item = c["id"].split("_")
        out.append("<trace>")
        out.append(s("Purchasing Document", po))
        out.append(s("Item", item))
        out.append(s("concept:name", c["id"]))
        out.append(s("Item Category", c["category"]))
        out.append(s("Document Type", "Standard PO"))
        out.append(s("Spend area text", "Packaging"))
        out.append(s("Company", "companyID_0000"))
        out.append(s("Vendor", c["vendor"]))
        out.append(s("Name", c["name"]))
        gr_flag = "true" if c["category"] != TWO else "false"
        out.append(f'<boolean key="Goods Receipt" value="{gr_flag}"></boolean>')
        out.append(f'<boolean key="GR-Based Inv. Verif." value="{"true" if c["category"] == IAG else "false"}"></boolean>')
        for act, user, ts, worth in c["events"]:
            out.append("<event>")
            out.append(s("User", user))
            out.append(s("org:resource", user))
            out.append(s("concept:name", act))
            out.append(f'<float key="Cumulative net worth (EUR)" value="{worth}"></float>')
            out.append(f'<date key="time:timestamp" value="{ts}{TZ}"></date>')
            out.append("</event>")
        out.append("</trace>")
    out.append("</log>\n")
    path.write_text("\n".join(out), encoding="utf-8")


if __name__ == "__main__":
    write(HERE / "planted.xes", PLANTED)
    write(HERE / "clean.xes", CLEAN)
    print("wrote planted.xes and clean.xes")
